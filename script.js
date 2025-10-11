let map;
let drawControl;
let selectedPolygon = null;
let rightClickMenu = false;
let mapMode = "rest-coast"; //"rest-coast" or "new-map"

// Setting the map view
var originalZoom = 4;
var originalCenter = {lat: 43.0000, lng: 10.0000};
// Initializing array for coastal units 
var polygons = [];
// Initializing global variables
//var contextMenu;
var locations;
var isEditPolygon = false;
// Create a marker group to manage them globally
var pilotMarkers = [];
let activePilot;
// Placeholder for Readme tab
let ReadmeTab = null;

// Function to display the initial instructions when the project is run
document.getElementById('confirmationMessage').style.display = 'none';
function showConfirmationMessage() {
	document.getElementById('confirmationMessage').style.display = 'block';
}

// ----------------------------------------------------------------------------------
// Loading map routine: Rest-Coast Coastal Units or New Map
// ----------------------------------------------------------------------------------

// Load Rest-Coast polygons
const loadBtn = document.getElementById('load-locations-btn');
loadBtn.addEventListener('click', async () => {
	
	mapMode = "rest-coast";
	await loadMap();
	
});
// Load new blank Map
const loadMapBtn = document.getElementById('load-new-locations-btn');
loadMapBtn.addEventListener('click', async () => {
	
	mapMode = "new-map";
	await loadMap();
	
});
// Open file selection dialog: coastal units incorporated in geojson file
const fileInput = document.getElementById('fileInput');
async function loadMap() {
	
	if (!map) {
		// Initial screen → just open file input
		if (mapMode == "rest-coast") {
			try {
				const response = await fetch("src/CoastalUnits.json");
				if (!response.ok) throw new Error("Default JSON not found in the src/");
				const JSONdata = await response.json();
				document.getElementById('confirmationMessage').style.display = 'none';
				initMap(JSONdata);
				return;
			} catch (err) {
				console.error("Error loading default map:", err);
				alert("Could not load default map. Please select your version of CoastalUnits.json");
			}
		} else if (mapMode === "new-map") {
				document.getElementById('confirmationMessage').style.display = 'none';
				initMap(null);
				return;
		}
	}
	
	// Clean up map if already loaded			
	if (map) {
		
		if ( polygons.length !== 0 ) {
			const saveFirst = confirm("Do you want to save Coastal Units before resetting the map?");

			if (saveFirst) {
				try {
					await saveJSONToFile(locations); 
				} catch (err) {
					console.error("Error saving file: ", err);
				}
			}
		} 
		
		// Remove map and its layers completely
		map.remove();   // Destroys the Leaflet map instance
		document.getElementById('map').style.display = 'none';
		map = null;     // Reset reference
	}
	
	polygons = [];
	locations = null;
	pilotMarkers.length = 0;
	urlExists = false;
	// Show confirmation screen again (initial page view)
	showConfirmationMessage();
	// Disable shape file loader
	shapefileBtn.style.pointerEvents = 'none';
	shapefileBtn.style.opacity = '0.5';
	// Disable reset view Button
	resetViewBtn.style.pointerEvents = 'none';
	resetViewBtn.style.opacity = '0.5';
	// Disable save locations Button
	saveLocsBtn.style.pointerEvents = 'none';
	saveLocsBtn.style.opacity = '0.5';
	//toggleButtons(false);
	
	if (mapMode == "rest-coast") {
		// Reset file input value and trigger file input
		fileInput.value = '';
		fileInput.click();
	} else if (mapMode === "new-map") {
		document.getElementById('confirmationMessage').style.display = 'none';
		initMap(null);
	}
}
// Function to handle the coastal units file: geojson 
fileInput.addEventListener('change', function onFileChange(e) {
	const file = e.target.files && e.target.files[0];
	
	if (!file) {
		console.warn('File selection canceled by user.');
		fileInput.value = '';
		return;
	}
	
	// Reading in the geojson file format
	const reader = new FileReader();
	reader.onload = function(event) {
		try {
			document.getElementById('confirmationMessage').style.display = 'none';
			const jsonData = JSON.parse(event.target.result);
			// If coastal units are loaded, then map is initialized with the data that is read from file
			initMap(jsonData);
		} catch (error) {
			console.error('Error parsing JSON:', error);
			alert('Invalid file format. Please select JSON file.');
		} finally {
			// Reset input so selecting the same file again will trigger onchange
			fileInput.value = "";
		}
	};
	reader.readAsText(file);	
});
// ------------------------------------------------------------
// End of loading existing polygons Routine
// ------------------------------------------------------------

// ------------------------------------------------------------
// Handle loading shape file in GeoJSON format
// ------------------------------------------------------------
const shapefileBtn = document.getElementById('file-select-btn');
const shapefileInput = document.getElementById('shapefileInput');
// Disable the shape file loader
if (!map || polygons.length === 0) {
	shapefileBtn.style.pointerEvents = 'none';
	shapefileBtn.style.opacity = '0.5';
}
// Shape file loader
shapefileBtn.addEventListener("click", () => {
	shapefileInput.click();
});

shapefileInput.addEventListener("change", event  => {
	const shapefile = event.target.files[0];
	
	if (!shapefile) {
		alert('File selection canceled by user.');
		event.target.value = "";
		return;
	}
	
	const ext = shapefile.name.split('.').pop().toLowerCase();
    if (ext === "geojson" || ext === "json") {
        // Handle GeoJSON as before
        handleGeoJsonFile(shapefile);
    } else if (ext === "zip") {
        // Handle zipped Shapefile
        handleShapefile(shapefile);
    } else {
        alert("Unsupported file type. Please upload a .geojson or .zip shapefile.");
    }

    event.target.value = ""; // reset
});

// Function to handle shp file 
function handleShapefile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        shp(e.target.result)
            .then(function (geojson) {
                createPolygonsFromGeoJson(geojson);
            })
            .catch(function (err) {
                console.error("Invalid .shp:", err);
                alert("Error: The selected file is not a valid .zip with .shp, .dbf, and .shx inside.");
            });
    };
    reader.readAsArrayBuffer(file);
}

// Function to handle GeoJSON file upload
function handleGeoJsonFile(file) {
	const reader = new FileReader();
	reader.onload = function (e) {
		try {
			const data = JSON.parse(e.target.result);
			createPolygonsFromGeoJson(data);
		} catch (error) {
			console.error('Invalid GeoJSON:', error);
			alert('Error: The selected file is not a valid GeoJSON.');
		} 
	};
	reader.readAsText(file);
}


// Helper function to check if any polygon is a valid and closed ring
function closeRings(rings) {
	return rings
		.map(ring => {
			if (!ring || ring.length < 3) return null;
			
			// Close rings
			const first = ring[0];
			const last = ring[ring.length - 1];
			if (first.lat !== last.lat || first.lng !== last.lng) {
				return [...ring, first];
			}
			
			// Check if the shape is at least a triangle
			const uniqueVertices = new Set(ring.slice(0, -1).map(p => `${p.lat}, ${p.lng}`));
			if (uniqueVertices.size < 3) return null;
			
			if (ring.length <4) return null;
			
			return ring;
		})
		.filter(Boolean);
}

// Function to create polygons from GeoJSON data
function createPolygonsFromGeoJson(data) {

	// Get all the features assigned to the pilot sites
	const features = data.features || [];
	// Check if features exist
	if (features.length === 0) {
		console.error('No features in GeoJSON data.');
		return;
	}
	
	let indexFeat = 0;
	let forPilot;
	// Loop through the features in the GeoJSON data
	function nextFeat() {
		
		if (indexFeat >= features.length) {
			// Enable user interaction events
			isEditPolygon = false;
			toggleButtons(true);
			if (activePilot !== "") { addDrawTools() };
			// Check if coastal units at a pilot site intersects (for display color purposes)
			checkIntersection(forPilot);	
			return;
		}
		
		const feature = features[indexFeat];
		indexFeat++;
		
		// Disable user interaction events
		isEditPolygon = true;
		toggleButtons(false);
		removeDrawTools();
		
		const geometry = feature.geometry;
		// Check geometry
		if (!geometry || !geometry.type) {
			console.error("Invalid geometry for feature:", feature);
			return;
		}
		
		// Get coordinates for normalization and validation
		const polygonsLoaded = [];
		if (geometry.type === "Polygon") {
			polygonsLoaded.push(closeRings(geometry.coordinates.map(ring => ring.map(coord => ({ lat: coord[1], lng: coord[0] })))));
		} else if (geometry.type === "MultiPolygon") {
			geometry.coordinates.forEach(coords =>  {
				polygonsLoaded.push(closeRings(coords.map(ring => ring.map(coord => ({ lat: coord[1], lng: coord[0] })))));
			});
		}
								
		const newCU = [];
		let areaCU = 0;
		polygonsLoaded.forEach(coords => {
			// Create leaflet polygon (handles Polygon + MultiPolygon)
			const polygon = L.polygon(coords).addTo(map);
			newCU.push(polygon)
			
			// Calculate area 
			const tempcoord = coords.map(ring => ring.map(ll => [ll.lng, ll.lat])); // GeoJSON format: [lng, lat]
			const poly = turf.polygon(tempcoord);	
			areaCU += turf.area(poly); 	
		});	
		
		const areaHa = Math.round(areaCU / 10000);
		
		// Show modal for this feature (user input metadata once)
		showModal((pilot, delin, nbsBB, nbsFW) => {
			
			// Check if the pilot exists
			if (!locations.find(item => item.name === pilot)) {
				const newPilot = {
					"name": pilot,
					"location": { "lat":turf.centroid(feature).geometry.coordinates[1], 
								"lng":turf.centroid(feature).geometry.coordinates[0]
					},
					"zoom": 13,
					"coastalUnits": []
				};
				locations.push(newPilot);
				
				// Get pilot information dynamically
				newPilot.description = getDescription(newPilot.name);
				
				// Create marker
				const marker = L.marker([newPilot.location.lat, newPilot.location.lng], {
					title: newPilot.name
				});

				marker.zoomLevel = newPilot.zoom; // Custom zoom level property

				// Store in group
				pilotMarkers.push(marker);
								
				assignMarkerEvents(marker);
				
				// Add marker to map by default
				//marker.addTo(map);
			}			
			// Check if the coastal units exists (let user overwrite coordinates)
			const existing = polygons.filter(p => p.options.pilot === pilot && p.options.delin === delin);
			let targetPilot = locations.find(item => item.name === pilot);
			const existingCU = targetPilot.coastalUnits.find(cu => cu.delin === delin);
			if (existing.length > 0) {
				const confirmOverwrite = confirm(
					`A coastal unit for pilot "${pilot}" with delineation "${delin}" already exists.\n\n` +
					`Do you want to overwrite the shape?\n\n` +
					`- Click OK to overwrite only the coordinates\n` +
					`- Click Cancel to remove existing shape and load new one`
				);
				// Remove old polygon from map and polygons array
				existing.forEach(p => {
					map.removeLayer(p);
					polygons.splice(polygons.indexOf(p), 1);
				});
				if (confirmOverwrite) {
					
					const polyOpt = {
						pilot: existing[0].options.pilot,
						delin: existing[0].options.delin,
						nbsBB: existing[0].options.nbsBB,
						nbsFW: existing[0].options.nbsFW
					};
					
					// Update new polygons
					newCU.forEach(polygon => {
						Object.assign(polygon.options, polyOpt);
						polygon.options.zIndex = -areaHa;
						assignPolygonEvents(polygon);
						polygons.push(polygon);
					});
					
					// Update locations							
					existingCU.coords = newCU.map(poly => closeRings(poly.getLatLngs())[0].map(ll => ({ lat: ll.lat, lng: ll.lng })));
				} else {
					// Add new polygons
					newCU.forEach(polygon => {
						Object.assign(polygon.options, { pilot, delin, nbsBB, nbsFW });
						polygon.options.zIndex = -areaHa;
						assignPolygonEvents(polygon);
						polygons.push(polygon);
					});
					
					// Store in locations
					existingCU.delin = delin;
					existingCU.nbsBB = nbsBB;
					existingCU.nbsFW = nbsFW;
					existingCU.coords = newCU.map(poly => closeRings(poly.getLatLngs())[0].map(ll => ({ lat: ll.lat, lng: ll.lng })));
				}
			} else {
				newCU.forEach(polygon => {
					Object.assign(polygon.options, { pilot, delin, nbsBB, nbsFW });
					polygon.options.zIndex = -areaHa;
					assignPolygonEvents(polygon);
					polygons.push(polygon);
				});
				
				// Store in locations
				targetPilot.coastalUnits.push({
				  delin,
				  nbsBB,
				  nbsFW,
				  shp: false,
				  coords: newCU.map(poly => closeRings(poly.getLatLngs())[0].map(ll => ({ lat: ll.lat, lng: ll.lng })))
				});
			}
			
			forPilot = pilot;
			// Sort polygons based on area
			reorderPolygons(forPilot);
			nextFeat();
		});				
	}
	nextFeat();	
}
// --------------------------------------------------------------------
// End of Loading Shape File Routine
// --------------------------------------------------------------------

// Function to reorder polygons per pilot based on area property (for Leaflet rendering that works on the order of drawing)
function reorderPolygons(pilot) {
	// Extract the indexes of polygons in pilot
	const indFilter = polygons
		.map((p, i) => (p.options.pilot === pilot ? i : -1))
		.filter(i => i !== -1);

	// Check if sorting is needed
	if (indFilter.length <= 1) return;
	
	// Extract and sort polygons based on area
	const polyFilter = indFilter.map(i => polygons[i]);
	polyFilter.sort((p1,p2) => p1.options.zIndex - p2.options.zIndex);
	
	// Sort the original polygons array 
	indFilter.forEach((idx, i) => {
		polygons[idx] = polyFilter[i];
	});
	
	// Reorder visually if required
	polyFilter.forEach(p => {
		if (p._map) p.bringToFront();
	});
}
	
// Show the intiail instructions when the project is run
//window.onload = showConfirmationMessage;
let urlExists = false;
window.onload = async function() {
	const params = new URLSearchParams(window.location.search);
	const pilot = params.get('pilot');
	const cu = params.get('cu');
	const nbs = params.get('nbs');
	if (pilot && cu && nbs) {
		pilot = pilot.toLowerCase().trim();
		cu = cu.toLowerCase().trim();
		nbs = nbs.toLowerCase().trim();
		try {
			const response = await fetch("src/CoastalUnits.json");
			if (!response.ok) throw new Error("Default JSON not found in the src/");
			const JSONdata = await response.json();
			const JSONextract = JSONdata
				.filter(p => p.name.toLowerCase().trim() === pilot)
				.map(p => ({
					...p,
					coastalUnits: p.coastalUnits.filter(poly => 
						poly.delin &&
						poly.nbsBB &&
						poly.delin.toLowerCase().trim() === cu && 
						poly.nbsBB.toLowerCase().trim() === nbs
					)
				}))
				.filter(p => p.coastalUnits.length > 0);
			urlExists = true;
			initMap(JSONextract);
			return;
		} catch (err) {
			console.error("Error loading the Coastal Unit", err);
			alert("Could not view the Coastal Unit. Please make sure there exists a correct link to the CoastalUnit.");
			window.close();
		}
	} else {
			showConfirmationMessage();
	}
}
// Assign readMe.txt file with data paper information to the authors header
document.querySelector("#authors span").addEventListener("click", function() {
	// Specify the path to the text file: pre-defined
	var filePath = "src/readMe.txt";
	// Open the text file in a new window
	window.open(filePath, "_blank");
});

// --------------------------------------------------------------------
// Drawing polygon Routine
// --------------------------------------------------------------------
let drawingStart = false;
let shapeCreated = false;
const linkArcachon = "https://drive.google.com/drive/folders/14kfy3J2D47sVUVsPQqH8vGJQuxNpzN_n?usp=drive_link";
const linkEbro = "https://drive.google.com/drive/folders/1cbguTtEOuqi3t-uEWU8t9dEGm0jJjnyy?usp=drive_link";
const linkForos = "https://drive.google.com/drive/folders/1_jKhsiJEUlY_8iofiM6NAQ3bu9RV2fd_?usp=drive_link";
const linkNahal = "https://drive.google.com/drive/folders/1uNh_awo9SCGO8V3wWGD_BFz0F62p5MWQ?usp=drive_link";
const linkRhone = "https://drive.google.com/drive/folders/1Wehb0uzDqF74xW8ZLN8ZisvwdjL85zPO?usp=drive_link";
const linkSicily = "https://drive.google.com/drive/folders/1U47bUtyYuPRs0Vtca5TkI6Md_XfemorU?usp=drive_link";
const linkVenice = "https://drive.google.com/drive/folders/19TrlqrfNqgxvNzp9wrVpAMi4Wnwy6TiA?usp=drive_link";
const linkVistula = "https://drive.google.com/drive/folders/1KUOtM3eGQcDmhWhctbXDV6UI4GvzxxdT?usp=drive_link";
const linkWadden = "https://drive.google.com/drive/folders/1Au4Nc0JxbWRXJVaRzzOeARsf-WOxy2pp?usp=drive_link";
const linkCustom = "https://drive.google.com/drive/folders/1tpR72tFvh6z7l4-61kEfUG1BPwvVxRID?usp=drive_link";
let linksToSharedFolders = {
	"Arcachon Bay": linkArcachon,
	"Ebro Delta": linkEbro,
	"Foros Bay": linkForos, 
	"Nahal Dalia": linkNahal, 
	"Rhone Delta": linkRhone,
	"Sicily Lagoon": linkSicily, 
	"Venice Lagoon": linkVenice,
	"Vistula Lagoon": linkVistula, 
	"Wadden Sea": linkWadden,
	"New Location": linkCustom
};
// custom function to activate draw tool
function addDrawTools() {
	if (!drawControl) {
		drawControl = new L.Control.Draw({
			position: 'topright',
			edit: false,
			draw: {
				polygon: true,
				polyline: false,
				rectangle: false,
				circle: false,
				marker: false,
				circlemarker: false
			}
		});
	}
	map.addControl(drawControl);
}
// custom function to add event listeners on draw tool
function addDrawEventListeners() {
	// Event-listener for drawing start
	map.on(L.Draw.Event.DRAWSTART, function () {
		//console.log("Drawing starts!");
		drawingStart = true;
		shapeCreated = false;
		isEditPolygon = true;
		toggleButtons(false);
		checkIntersection(activePilot);
	});
	
	// Event-listener for drawing cancelled
	map.on(L.Draw.Event.DRAWSTOP, function () {
		if (drawingStart && !shapeCreated) {
			//console.log("Drawing cancelled!");
			isEditPolygon = false;
			toggleButtons(true);
			checkIntersection(activePilot);
		}
		drawingStart = false;
	});
	
	map.on(L.Draw.Event.CREATED, function(event) {
		
		shapeCreated = true;
	
		// disable draw control
		removeDrawTools();
		
		const polygon = event.layer;
		polygon.addTo(map);
		
		// Show modal for user properties
		showModal(function (pilot_site, delineation, building_block, framework) {
			
			// Check if the pilot exists
			if (!locations.find(item => item.name === pilot_site)) {
				const feature = polygon.toGeoJSON();
				const newPilot = {
					"name": pilot_site,
					"location": { "lat":turf.centroid(feature).geometry.coordinates[1], 
								"lng":turf.centroid(feature).geometry.coordinates[0]
					},
					"zoom": 13,
					"coastalUnits": []
				};
				locations.push(newPilot);
				
				// Get pilot information dynamically
				newPilot.description = getDescription(newPilot.name);
				
				// Create marker
				const marker = L.marker([newPilot.location.lat, newPilot.location.lng], {
					title: newPilot.name
				});

				marker.zoomLevel = newPilot.zoom; // Custom zoom level property

				// Store in group
				pilotMarkers.push(marker);
								
				assignMarkerEvents(marker);
				
				// Add marker to map by default
				//marker.addTo(map);
			}			
			
			// Assign user-defined properties
			polygon.options.pilot = pilot_site;
			polygon.options.delin = delineation;
			polygon.options.nbsBB = building_block;
			polygon.options.nbsFW = framework;

			// Compute area in hectares
			const coords = polygon.getLatLngs()[0].map(ll => [ll.lng, ll.lat]);
			coords.push(coords[0]); // close ring
			const poly = turf.polygon([coords]);
			const areaHa = Math.round(turf.area(poly) / 10000);
			polygon.options.zIndex = -areaHa;

			// Attach polygon events
			assignPolygonEvents(polygon);

			// Store in global arrays
			polygons.push(polygon);
			const newUnit = {
				delin: delineation,
				nbsBB: building_block,
				nbsFW: framework,
				shp: false,
				coords: polygon.getLatLngs()[0].map(ll => ({ lat: ll.lat, lng: ll.lng }))
			};
			let targetPilot = locations.find(item => item.name === pilot_site);
			if (targetPilot) {
				targetPilot.coastalUnits.push(newUnit);
			}

			// Reset UI
			isEditPolygon = false;
			toggleButtons(true);
			addDrawTools();
			
			// Run intersection check
			checkIntersection(pilot_site);
			// Sort polygons based on area
			reorderPolygons(pilot_site);
		});
		
	});	
}
// custom function to remove draw tool
function removeDrawTools() {
	if (drawControl) {
		map.removeControl(drawControl);
	}
}
// ------------------------------------------------------
// End of drawing polygon Routine
// ------------------------------------------------------

// Function to show modal to set the properties for the user-drawn or uploaded polygon
function showModal(callback) {
	// Create modal container
	const modalContainer = document.createElement("div");
	modalContainer.className = "modal";
	
	// Create modal content
	const modalContent = document.createElement("div");
	modalContent.className = "modal-content";
	
	// Create heading
	const heading = document.createElement("h3");
	heading.textContent = "Select the pilot site:";
	modalContent.appendChild(heading);
	
	// Dropdown + button wrapper
	const dropdownWrapper = document.createElement("div");
	dropdownWrapper.style.display = "flex";
	dropdownWrapper.style.alignItems = "center";
	dropdownWrapper.style.gap = "10px";

	// Create dropdown menu
	const dropdown = document.createElement("select");
	dropdown.id = "dropdown";
	const dflt = document.createElement("option");
	dflt.value = "";
	dflt.disabled = true;
	dflt.selected = true;
	dflt.textContent = "Select Pilot";
	dropdown.appendChild(dflt);
	// Set the pilot names in the dropdown menu
	let pilots;
	if (mapMode ===  "rest-coast") {
		pilots = ["Arcachon Bay", "Ebro Delta", "Foros Bay", "Nahal Dalia", "Rhone Delta", "Sicily Lagoon", "Venice Lagoon", "Vistula Lagoon", "Wadden Sea", "New Location"];
	} else {
		pilots = ["New Location"];
	}
	pilots.forEach(pilot => {
		const option = document.createElement("option");
		option.value = pilot;
		option.textContent = pilot;
		// Append pilots to dropdown
		dropdown.appendChild(option);
	});
	modalContent.appendChild(dropdown);
	
	// Create button to direct users to shared folders
	const infoButton = document.createElement("button");
	infoButton.textContent = "Go to Shared Folder";
	infoButton.disabled = true;
	infoButton.title = "Click to open the shared folder for this site!"
	
	infoButton.addEventListener("click", () => {
		if (activePilot !== "" && dropdown.value !== activePilot && dropdown.value !== "New Location") {
			alert("Please verify the selected pilot site!");
			return;
		}
		if (linksToSharedFolders[dropdown.value]) {
			window.open(linksToSharedFolders[dropdown.value], "_blank");
		}
	});
	
	// Create inline tip text
	const tipText = document.createElement("span");
	tipText.innerHTML = 'Go to the shared folder to select the framework application data and copy the link below.<br>' +
						  'Please use e.g. "The NB3 Instance newUnit1" to assign new data to the Coastal Unit.';
	tipText.style.color = "#003366";
	tipText.style.fontStyle = "italic";
	tipText.style.fontSize = "14px";
	tipText.style.marginLeft = "5px";
	tipText.style.display = "none"; 
	
	// Enable button only when pilot is selected
	dropdown.addEventListener("change", () => {
		infoButton.disabled = dropdown.value === "";
		tipText.style.display = dropdown.value === "" ? "none" : "inline";
		textFieldHeading.style.display = dropdown.value === "New Location" ? 'block' : "none";
		textField.style.display = dropdown.value === "New Location" ? 'block' : "none";
	});
	
	// Add dropdown + button to wrapper
	dropdownWrapper.appendChild(dropdown);
	dropdownWrapper.appendChild(infoButton);
	dropdownWrapper.appendChild(tipText);
	
	// Add wrapper to modal
	modalContent.appendChild(dropdownWrapper);
	
	// New location properties
	const textFieldHeading = document.createElement("h4");
	textFieldHeading.textContent = "Pilot Name";
	textFieldHeading.style.display = "none";
	// Create input field for new location
	const textField = document.createElement("input");
	textField.type = "text";
	textField.id = "textField4";
	textField.placeholder = "e.g. Gediz Delta";
	textField.style.display = "none";
	modalContent.appendChild(textFieldHeading);
	modalContent.appendChild(textField);
		
	// Create fields for user-defined coastal unit properties
	let inputs = [
		{ header: "Coastal Unit Code: ", id: "textField1", placeholder: "e.g. CU#1" },
		{ header: "NbS-driven Restoration Process: ", id: "textField2", placeholder: "e.g. Salt marsh revegetation" },
		{ header: "Link to the data from the application of the framework: ", id: "textField3", placeholder: "https://..."}
	];
	inputs.forEach(input => {
		// Create headings for coastal unit properties
		const textFieldHeading = document.createElement("h4");
		textFieldHeading.textContent = input.header;
		// Create input fields for coastal unit properties
		const textField = document.createElement("input");
		textField.type = "text";
		textField.id = input.id;
		textField.placeholder = input.placeholder;
		modalContent.appendChild(textFieldHeading);
		modalContent.appendChild(textField);
	});
					
	// Create submit button
	const submitButton = document.createElement("button");
	submitButton.textContent = "Submit";
	// Add event listener for the submit button
	submitButton.addEventListener("click", function() {
		// Retrieve user input
		if (activePilot ) {
			if (!dropdown.value || dropdown.value !== activePilot) {
				alert("Please verify the selected pilot site!");
				return;
			}
		} else {
			if (!dropdown.value) {
				alert("Please verify the selected pilot site!");
				return;
			}
		}
		
		const pilot_name = dropdown.value === "New Location" ? document.getElementById("textField4").value : dropdown.value;
		const delineation = document.getElementById("textField1").value || "";
		const building_block = document.getElementById("textField2").value || "";
		const framework = document.getElementById("textField3").value || "";
		
		// Hide the modal
		document.body.removeChild(modalContainer);
		// Call the callback function with the user input values
		callback(pilot_name, delineation, building_block, framework);
	});
	modalContent.appendChild(submitButton);
	// Append modal content to modal container
	modalContainer.appendChild(modalContent);	
	
	// Append modal container to body: below the project headers before the map
	document.body.insertBefore(modalContainer,document.getElementById("map"));
	
}
// Add event listener for reset view button
const resetViewBtn = document.getElementById('reset-view-button');
resetViewBtn.addEventListener('click', function() {
	// Reset active pilot
	activePilot = "";
	
	// Reset zoom and center to Europe scale overview
	//map.setView([originalCenter.lat, originalCenter.lng], originalZoom);
	map.flyTo([originalCenter.lat, originalCenter.lng], originalZoom, {
		animate: true,
		duration: 1.5,
		easeLinearity: 0.25
	});
	// Re-add all markers
	pilotMarkers.forEach(marker => {
		if (!map.hasLayer(marker)) {
			marker.addTo(map);
		}
	});
	
	// Hide coastal units
	polygons.forEach(poly => {
		if (map.hasLayer(poly)) {
			map.removeLayer(poly);
		}
	});

	// Hide draw control
	removeDrawTools();
	
});

// Add event listener to the save-locations-btn:
// Save all the coastal units including user-defined and user-loaded
const saveLocsBtn = document.getElementById('save-locations-btn');
// Disable the reset view button
if (!map || polygons.length === 0) {
	saveLocsBtn.style.pointerEvents = 'none';
	saveLocsBtn.style.opacity = '0.5';
}
if (!saveLocsBtn.dataset.bound) {
	saveLocsBtn.addEventListener('click', async () => {
		try{
			await saveJSONToFile(locations);
		} catch (err) {
			if (err.name === "AbortError") {
				console.log("Save cancelled.");
			} else {
				console.error("Error saving: ", err);
			}
		}
	});
	saveLocsBtn.dataset.bound = "true";
}
// Function to save the coastal units and their associated data as json file to local drive
async function saveJSONToFile(data) {
	// format date for filename
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, "0"); // makes date and time 0-based
	const dd = String(now.getDate()).padStart(2, "0");
	const hh = String(now.getHours()).padStart(2, "0");
	const mi = String(now.getMinutes()).padStart(2, "0");
	const fileName = `CoastalUnits_${yyyy}-${mm}-${dd}_${hh}h${mi}m.json`;
	const options = {
		suggestedName: fileName,
		types: [
			{
				description: "JSON Files",
				accept: {"application/json": [".json"]}
			}
		]
	};
	
	// Describe the output file type
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	// Handle directory selection and writing the output file
	const fileHandle = await window.showSaveFilePicker(options);
	const writableStream = await fileHandle.createWritable();
	await writableStream.write(blob);
	await writableStream.close();
	// Log the operation in console
	console.log('File saved successfully:', fileName);
}

// Disable the reset view button
if (!map || polygons.length === 0) {
	resetViewBtn.style.pointerEvents = 'none';
	resetViewBtn.style.opacity = '0.5';
}

// Initialize and create the map with pre-defined coastal units as input
async function initMap(inputJSON) {

	document.getElementById('map').style.display = 'block';
	
	// Open Street Map
	const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	  maxZoom: 19,
	  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	});

	// ESRI Satellite
	const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
		maxZoom: 19,
		attribution: '&copy; Esri & contributors'
	  }
	);

	// Hybrid (labels on top of satellite)
	const esriLabels = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
		maxZoom:19,
		attribution: '&copy; Esri',
		pane: 'overlayPane'
	  }
	);
	
	// Initialize map
	map = L.map('map').setView([originalCenter.lat, originalCenter.lng], originalZoom);
	map.addLayer(esriSat);

	// Add control
	L.control.layers(
	  {
		"Satellite": esriSat,
		"Open Street Map": osm
	  },
	  { "Labels": esriLabels },
	  { position: 'topleft' }
	).addTo(map);
	
	// add custom labels to draw polygon tool
	L.drawLocal.draw.toolbar.buttons.polygon = 'Draw a new Coastal Unit';

	L.drawLocal.draw.handlers.polygon.tooltip = {
	  start: 'Click to start drawing a Coastal Unit',
	  cont: 'Click to continue drawing',
	  end: 'Click first point to demarcate the Coastal Unit'
	};

	L.drawLocal.edit.toolbar.buttons.edit = 'Edit the Coastal Unit';
	L.drawLocal.edit.toolbar.buttons.remove = 'Delete the Coastal Unit';
	// add draw control events
	addDrawEventListeners();
	
	if (inputJSON && inputJSON.length > 0) {
		// Assign coastal units to locations variable
		locations = inputJSON;
			
		// Loop through the locations data: pilot data and coastal units associated to each pilot
		locations.forEach(function(place) {
			// For each pilot, define polygons from coastal unit geographical data
			place.coastalUnits.forEach(function(polygonData) {
				if (!polygonData.shp){			
					
					let polyOrMultipoly = [];
					if (!polygonData.coords || polygonData.coords.length === 0) return;
					if (polygonData.coords[0].lat !== undefined) {
						polyOrMultipoly = [polygonData.coords];
					} else {
						polyOrMultipoly = polygonData.coords;
					}
					
					let totArea = 0;
					let tempPolygons = [];
					polyOrMultipoly.forEach(element => {
						
						if (!element || !Array.isArray(element) || element.length < 3) return;
						
						const first = element[0];
						const last = element[element.length - 1];
						if (first.lat !== last.lat || first.lng !== last.lng) {
							element.push(first);
						}
						
						const uniqueVertices = new Set(element.slice(0,-1).map(p => `${p.lat}, ${p.lng}`));
						if (uniqueVertices.size < 3) return;
						
						if (element.length < 4) return;
						
						tempPolygons.push(element);
						
						// Calculate area 
						const ring = element.map(ll => [ll.lng, ll.lat]); // GeoJSON format: [lng, lat]
						const poly = turf.polygon([ring]);
						totArea += turf.area(poly);
					});
					
					// Area & zindex
					const areaHa = Math.round(totArea / 10000); // m² → ha
					
					tempPolygons.forEach(coords => {
						
						const polygon = L.polygon(coords, {
							pilot: place.name,
							delin: polygonData.delin,
							nbsBB: polygonData.nbsBB,
							nbsFW: polygonData.nbsFW,
							zIndex: -areaHa
						});		
											
						assignPolygonEvents(polygon);
						
						// Add coastal units to polygons array
						polygons.push(polygon);
					});						
				}	
			});
			// Sort polygons based on area
			reorderPolygons(place.name);
			
			// Check if coastal units at a pilot site intersects (for display color purposes)
			// optional intersection check (implement later)
			if (typeof checkIntersection === 'function') checkIntersection(place.name);
			
			// Loop through the locations and add markers to the map for pilot locations
			// Get pilot information dynamically
			place.description = getDescription(place.name);
			
			// Create marker
			const marker = L.marker([place.location.lat, place.location.lng], {
				title: place.name
			});

			marker.zoomLevel = place.zoom; // Custom zoom level property

			// Store in group
			pilotMarkers.push(marker);
							
			assignMarkerEvents(marker);
			
			// Add marker to map by default
			marker.addTo(map);

			// Change the view routine if the polygon is loaded from url
			if (urlExists) {
				addDrawTools();
				polygons.forEach(p => !map.hasLayer(p) && p.addTo(map));
				map.flyTo([place.location.lat, place.location.lng], place.zoom, {
					animate: true,
					duration: 1.5,
					easeLinearity: 0.25
				});
			}
		});
	} else {
		//console.log("You have blank map!");
		activePilot = "";
		// Initialize locations json
		locations = [];
	}
	
	// Activate shape file loader
	shapefileBtn.style.pointerEvents = 'auto';
	shapefileBtn.style.opacity = '1';
	// Activate reset view button
	resetViewBtn.style.pointerEvents = 'auto';
	resetViewBtn.style.opacity = '1';
	// Activate save locations Button
	saveLocsBtn.style.pointerEvents = 'auto';
	saveLocsBtn.style.opacity = '1';
	//toggleButtons(true);
	
	// Reset global menu open flag
	map.on('click', function() {
		rightClickMenu = false;
	});
	
	// Add zoom in event to activate draw tool
	map.on('zoomend', function () {
		if (map.getZoom() >= 10) {
			addDrawTools();
			polygons.forEach(p => !map.hasLayer(p) && p.addTo(map));
		} else  {
			removeDrawTools();
			polygons.forEach(p => map.hasLayer(p) && map.removeLayer(p));
		}
		map.getZoom() >= 6
			? pilotMarkers.forEach(m => map.hasLayer(m) && map.removeLayer(m))
			: pilotMarkers.forEach(m => !map.hasLayer(m) && m.addTo(map));
	});
	
	// Create the legend element: Credentials for developer
	map.attributionControl.addAttribution('&copy; Developed by Cengiz Arslan, 2024');
}
////////////////////////////////////////////////////
// Auxiliary functions to support map operations///
///////////////////////////////////////////////////

// --------------------------------------------------
// Functions to control right click menu on a polygon
// --------------------------------------------------
// Function to handle delete a coastal unit (polygon)
function deletePolygon() {
	// work on the polygon that is activated in the main routine
	if (selectedPolygon) {
		// close the menu
		if (selectedPolygon.menuPopup && map.hasLayer(selectedPolygon.menuPopup)) {
			map.closePopup(selectedPolygon.menuPopup);
			selectedPolygon.menuPopup = null;
			rightClickMenu = false;
		}
						
		// Extract the coastal unit code of the selected polygon
		const delinToRemove =  selectedPolygon.options.delin;				
		// Remove the selected polygon from the map
		 polygons
			.filter(p => p.options.delin === delinToRemove)
			.forEach(p => {
				if (map.hasLayer(p)) map.removeLayer(p);
			});

		// Remove them from polygons array
		polygons = polygons.filter(p => p.options.delin !== delinToRemove);
		checkIntersection(selectedPolygon.options.pilot);
		
		// Iterate through each pilot in the JSON array
		locations.forEach(location => {
			// Filter out the coastal unit according to the coastal unit code
			location.coastalUnits = location.coastalUnits.filter(coastalUnit => coastalUnit.delin !== delinToRemove);
		});
		
		// Reset selected polygon
		selectedPolygon = null;						
	}
}

// Function to handle edit action on the selected coastal unit
function editPolygon() {
	// work on the polygon that is activated in the main routine
	if (!selectedPolygon) return;
	
	// lock buttons while editing
	toggleButtons(false);
	removeDrawTools();
	
	// close the menu
	if (selectedPolygon.menuPopup && map.hasLayer(selectedPolygon.menuPopup)) {
		selectedPolygon.menuPopup.remove();
		selectedPolygon.menuPopup = null;
		rightClickMenu = false;
	}
	
	// Extract pilot name and coastal unit code from the selected coastal unit
	const pilt = selectedPolygon.options.pilot;
	const deli = selectedPolygon.options.delin;
	const bb = selectedPolygon.options.nbsBB;
	const fw = selectedPolygon.options.nbsFW;
	
	// Set global variable for polygon editing 
	isEditPolygon = true;
	selectedPolygon.setStyle({ dashArray: "5,5" });
	
	// Show a modal dialog with input fields for editing properties
	showModal2(deli, bb, fw, function(delineation, building_block, framework) {
		
		// Modify the coastal unit with user input from modal dialogue 
		selectedPolygon.delin = delineation;
		selectedPolygon.nbsBB = building_block; 
		selectedPolygon.nbsFW = framework;
		
		 // Update leaflet compatible options for potential future use
		selectedPolygon.options.delin = delineation;
		selectedPolygon.options.nbsBB = building_block;
		selectedPolygon.options.nbsFW = framework;
		
		// Find the coastal unit's pilot in the json array
		const matchingLocation = locations.find(location => location.name === pilt);
		if (matchingLocation) {
			// Find the coastal unit in json array according to the coastal unit code of the polygon
			const matchingCoastalUnit = matchingLocation.coastalUnits.find(coastalUnit => coastalUnit.delin === deli && coastalUnit.nbsBB === bb);
			if (matchingCoastalUnit) {
				// Modify the properties of the coastal unit in the json array too
				matchingCoastalUnit.delin = delineation;
				matchingCoastalUnit.nbsBB = building_block;
				matchingCoastalUnit.nbsFW = framework;
			}
		}
		
		// Set global polygon edit flag
		isEditPolygon = false;
		selectedPolygon.setStyle({ dashArray: null });
		// Release buttons after editing
		toggleButtons(true);
		addDrawTools();
	});
				
	// Function to create modal dialogue for user input
	function showModal2(deliPlaceHolder, bbPlaceHolder, fwPlaceHolder, callback) {
		// Create modal container
		const modalContainer = document.createElement("div");
		modalContainer.className = "modal";
		
		// Create modal content
		const modalContent = document.createElement("div");
		modalContent.className = "modal-content";
		
		// Create heading for the specific coastal unit at a specific pilot
		const heading = document.createElement("h3");
		heading.textContent = `Edit Properties of ${deliPlaceHolder} @${pilt}`;
		modalContent.appendChild(heading);
		
		// Create heading for text fields
		let fields = [
			{ label: "Name of the Coastal Unit:", placeholder: deliPlaceHolder, id: "textField1" },
			{ label: "NbS-driven Restoration Process:", placeholder: bbPlaceHolder, id: "textField2" },
			{ label: "Link to Framework Application Data:", placeholder: fwPlaceHolder, id: "textField3" }
		];
		
		fields.forEach(f => {
			const h4 = document.createElement("h4");
			h4.textContent = f.label;
			const input = document.createElement("input");
			input.type = "text";
			input.id = f.id;
			input.placeholder = f.placeholder;
			modalContent.appendChild(h4);
			modalContent.appendChild(input);
		});
		
		// Info text + buttons wrapper
    	const buttonWrapper = document.createElement("div");
    	buttonWrapper.style.display = "flex";
    	buttonWrapper.style.marginLeft = "12px";
    	buttonWrapper.style.alignItems = "center";
		buttonWrapper.style.marginTop = "10px"; 
		
		// Create button to direct users to shared folders
		const infoButton = document.createElement("button");
		infoButton.textContent = "Go to Shared Folder";
		infoButton.title = "Click to open the shared folder for this site!";
		const pilots = ["Arcachon Bay", "Ebro Delta", "Foros Bay", "Nahal Dalia", "Rhone Delta", "Sicily Lagoon", "Venice Lagoon", "Vistula Lagoon", "Wadden Sea"];
		let linkTo = "";
		infoButton.addEventListener("click", () => {
			if (pilots.includes(pilt)) {
				linkTo = linksToSharedFolders[pilt];
			} else {
				linkTo = linksToSharedFolders["New Location"];
			}
			window.open(linkTo, "_blank");
		});
		
		// Create inline tip text
		const tipText = document.createElement("span");
		tipText.innerHTML = 'Go to the shared directory to select the framework application data and copy the link below.<br>' +
							'Please use, e.g. "The NB3 Instance newUnit1", to assign new data file to the Coastal Unit.';
		tipText.style.color = "#003366";
		tipText.style.fontStyle = "italic";
		tipText.style.fontSize = "14px";
		tipText.style.marginLeft = "5px";
		
		// Add elements to wrapper
    	buttonWrapper.appendChild(infoButton);
    	buttonWrapper.appendChild(tipText);
    	// Add wrapper to modal
    	modalContent.appendChild(buttonWrapper);
		
		// Create submit button for user to make changes
		const submitButton = document.createElement("button");
		submitButton.textContent = "Submit";
		submitButton.addEventListener("click", function() {
			// Get values from text fields
			const delineation = document.getElementById("textField1").value || deliPlaceHolder;
			const building_block = document.getElementById("textField2").value || bbPlaceHolder;
			const framework = document.getElementById("textField3").value || fwPlaceHolder;
			
			// Hide the modal dialogue
			document.body.removeChild(modalContainer);
			
			// Call the callback function with the user input values
			callback(delineation, building_block, framework);
		});
    	modalContent.appendChild(submitButton);
		
		modalContainer.appendChild(modalContent);
		
		// Append modal container to body
		document.body.insertBefore(modalContainer,document.getElementById("map"));
	}
}

// Function to handle changing the shape of coastal unit (polygon)
function editPoints() {
	// Work on the polygon that is activated in the main routine		
	if (!selectedPolygon) return;
				
	// close the menu
	if (selectedPolygon.menuPopup && map.hasLayer(selectedPolygon.menuPopup)) {
		selectedPolygon.menuPopup.remove();
		selectedPolygon.menuPopup = null;
		rightClickMenu = false;
	}
	
	// Set the global polygon edit variable as aactive
	isEditPolygon = true;
	
	// lock buttons while editing
	toggleButtons(false);
	// show done editing button
	document.getElementById('done-editing-btn').style.display = 'block';
	
	// disable draw control
	removeDrawTools();
	
	// Enable editing for the polygon
	selectedPolygon.pm.enable({ allowSelfIntersection:false });
		
	selectedPolygon.setStyle({ dashArray: "5,5" });
}

function doneEditing() {
	// Work on the polygon that is activated in the main routine		
	if (!selectedPolygon) return;
	
	selectedPolygon.pm.disable();
	
	// Extract pilot name and coastal unit code 
	const pilt = selectedPolygon.options.pilot;
	const deli = selectedPolygon.options.delin;
	const bb = selectedPolygon.options.nbsBB;
			
	// Calculate area (simple approximation; for exact ha use turf.js later)
	const latlngs = selectedPolygon.getLatLngs()[0];
	const newCoordinates = latlngs.map(ll => [ll.lng, ll.lat]); // GeoJSON format: [lng, lat]
	// close the polygon ring
	newCoordinates.push(newCoordinates[0]);
	const poly = turf.polygon([newCoordinates]);
	const areaHa = Math.round(turf.area(poly) / 10000); // m² → ha
	selectedPolygon.options.zIndex = -areaHa;

	// poly coordinates (corrected for lat, lng
	const updatedCoordinates = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
	// close the polygon ring
	updatedCoordinates.push(updatedCoordinates[0]);
	
	// Extract the pilot from the user-loaded json data
	const matchingLocation = locations.find(location => location.name === pilt);
	if (matchingLocation) {
		// Extract the coastal unit that has been modified
		const matchingCoastalUnit = matchingLocation.coastalUnits.find(coastalUnit => coastalUnit.delin === deli && coastalUnit.nbsBB ===bb);
		if (matchingCoastalUnit) {
			// Update the coordinates of the modified coastal unit
			matchingCoastalUnit.coords = updatedCoordinates;
		}
	}
				
	// Set the global polygon edit variable to passive
	isEditPolygon = false;
	// Reset highlight
	selectedPolygon.setStyle({ dashArray: null });
	// Reset selectedPolygon
	selectedPolygon = null;	
	// release buttons after editing
	toggleButtons(true);
	// enable draw control
	addDrawTools();
	// remove done editing button
	document.getElementById("done-editing-btn").style.display = 'none';
	
	// Check if multiple coastal units at a pilot site intersects (for display color purposes)
	const checkPolygons = polygons.filter(poly => poly.options.pilot == pilt);
	if (checkPolygons.length > 1) {
		checkIntersection(pilt);
	}
}

// Getting unique links to each polygon
function linkToPolygon() {
	// Work on the polygon that is activated in the main routine		
	if (!selectedPolygon) return;
				
	// close the menu
	selectedPolygon.menuPopup.remove();
	selectedPolygon.menuPopup = null;
	rightClickMenu = false;
	
	const pilotID = selectedPolygon.options.pilot;
	const cuID = selectedPolygon.options.delin;
	const nbsID = selectedPolygon.options.nbsBB;
	const urlPoly = `${window.location.origin}${window.location.pathname}?pilot=${pilotID}&cu=${cuID}&nbs=${nbsID}`;

	navigator.clipboard.writeText(urlPoly);
	alert("Link to the Coastal Unit is copied:\n" + urlPoly);

}
// Disabling buttons when editing in action
function toggleButtons(enable) {
	const ids = ["reset-view-button", "load-locations-btn", "load-new-locations-btn", "save-locations-btn", "file-select-btn"];
	ids.forEach(id => {
		const myBtn = document.getElementById(id);
		if (enable) {
			myBtn.style.pointerEvents = 'auto';
			myBtn.style.opacity = "1";
		} else {
			myBtn.style.pointerEvents = 'none';
			myBtn.style.opacity = "0.5";
		}
	});
}	

// Event listener for finalizing polygon editing
document.getElementById("done-editing-btn").onclick = function () {
	doneEditing();
};
// ---------------------------------------------
// End of right click menu operations
// ---------------------------------------------

// Function to generate corresponding information for the pilot markers
function getDescription(name) {
	// Match the pilot that is requested by the marker operation
	switch (name) {
		case 'Wadden Sea':
			return '<div><strong>' + "North Sea, Core Pilot" + '</strong><br>' + "Quick facts" + '<br>' 
					+ "Scale: Cross-border" + '<br>' + "Countries: The Netherlands & Germany" + '<br>'
					+ "Coastal elements: estuary, lagoon" + '<br>' 
					+ "Download: " +
					'<a href="https://rest-coast.eu/storage/app/uploads/public/63e/0c7/c76/63e0c7c760a60705312309.pdf#Wadden%20Sea%20(2).pdf" target="_blank">Factsheet Wadden Sea</a>' + '<br>'
					+ "Go to: " + 
					'<a href="' + linkWadden + '"target="_blank">Shared Directory</a>'
					+ '</div>'; 
		case 'Venice Lagoon':
			return '<div><strong>' + "Central Mediterranean, Core Pilot" + '</strong><br>' + "Quick facts" + '<br>' 
					+ "Scale: Regional" + '<br>' + "Countries: Italy" + '<br>'
					+ "Coastal elements: lagoon, wetlands, islands" + '<br>' 
					+ "Download: " +
					'<a href="https://rest-coast.eu/storage/app/uploads/public/634/68f/767/63468f7677b1d714344974.pdf#Rest-Coast%20Pilot%20Fact%20Sheet_Venice%20Lagoon_.pdf" target="_blank">Factsheet Venice Lagoon</a>' + '<br>'
					+ "Go to: " + 
					'<a href="' + linkVenice + '"target="_blank">Shared Directory</a>'
					+ '</div>'; 
		case 'Arcachon Bay':
			return '<div><strong>' + "Atlantic bay, Fellow Pilot" + '</strong><br>' + "Quick facts" + '<br>' 
					+ "Scale: Regional" + '<br>' + "Countries: France" + '<br>'
					+ "Coastal elements: bay, coast" + '<br>' 
					+ "Download: " +
					'<a href="https://rest-coast.eu/storage/app/uploads/public/63e/a5c/3c9/63ea5c3c970c7662954043.pdf#Arcachon%20Bay_factsheet.pdf" target="_blank">Factsheet Arcachon Bay</a>' + '<br>'
					+ "Go to: " + 
					'<a href="' + linkArcachon + '"target="_blank">Shared Directory</a>'
					+ '</div>'; 
		case 'Ebro Delta':
			return '<div><strong>' + "West Mediterranean, Core Pilot" + '</strong><br>' + "Quick facts" + '<br>' 
					+ "Scale: Regional" + '<br>' + "Countries: Spain" + '<br>'
					+ "Coastal elements: delta, bay, open, coast, lagoon" + '<br>' 
					+ "Download: " +
					'<a href="https://rest-coast.eu/storage/app/media/REST-COAST%20Pilot%20Site%20fact%20sheet_%20EbroDelta.pdf" target="_blank">Factsheet Ebro Delta</a>' + '<br>'
					+ "Go to: " + 
					'<a href="' + linkEbro + '"target="_blank">Shared Directory</a>'
					+ '</div>'; 
		case 'Sicily Lagoon':
			return '<div><strong>' + "Mediterranean Island, Fellow Pilot" + '</strong><br>' + "Quick facts" + '<br>' 
					+ "Scale: Regional" + '<br>' + "Countries: Italy" + '<br>'
					+ "Coastal elements: lagoon, wetland" + '<br>' 
					+ "Download: " +
					'<a href="https://rest-coast.eu/storage/app/media/Rest-Coast%20Pilot%20Fact%20Sheet_Sicily_final.pdf" target="_blank">Factsheet Sicily Lagoon</a>' + '<br>'
					+ "Go to: " + 
					'<a href="' + linkSicily + '"target="_blank">Shared Directory</a>'
					+ '</div>';
		case 'Foros Bay':
			return '<div><strong>' + "Black Sea, Fellow Pilot" + '</strong><br>' + "Quick facts" + '<br>' 
					+ "Scale: Regional" + '<br>' + "Countries: Bulgaria" + '<br>'
					+ "Coastal elements: bay" + '<br>' 
					+ "Download: " +
					'<a href="https://rest-coast.eu/storage/app/media/Foros%20Bay_factsheet.pdf" target="_blank">Factsheet Foros Bay</a>' + '<br>'
					+ "Go to: " + 
					'<a href="' + linkForos + '"target="_blank">Shared Directory</a>'
					+ '</div>';
		case 'Rhone Delta':
			return '<div><strong>' + "Central Mediterranean, Fellow Pilot" + '</strong><br>' + "Quick facts" + '<br>' 
					+ "Scale: Regional" + '<br>' + "Countries: France" + '<br>'
					+ "Coastal elements: delta, lagoon" + '<br>' 
					+ "Download: " +
					'<a href="https://rest-coast.eu/storage/app/media/Rhone%20Delta_final.pdf" target="_blank">Factsheet Rhone Delta</a>' + '<br>'
					+ "Go to: " + 
					'<a href="' + linkRhone + '"target="_blank">Shared Directory</a>'
					+ '</div>';
		case 'Vistula Lagoon':
			return '<div><strong>' + "Baltic sea, Fellow Pilot" + '</strong><br>' + "Quick facts" + '<br>' 
					+ "Scale: Regional" + '<br>' + "Countries: Poland, Russia" + '<br>'
					+ "Coastal elements: island, lagoon" + '<br>' 
					+ "Download: " +
					'<a href="https://rest-coast.eu/storage/app/media/Rest-Coast%20Pilot%20Fact%20Sheet_Vistula_final.pdf" target="_blank">Factsheet Vistula Lagoon</a>' + '<br>'
					+ "Go to: " + 
					'<a href="' + linkVistula + '"target="_blank">Shared Directory</a>'
					+ '</div>';
		case 'Nahal Dalia':
			return '<div><strong>' + "East Mediterranean, Fellow Pilot" + '</strong><br>' + "Quick facts" + '<br>' 
					+ "Scale: Regional" + '<br>' + "Countries: Israel" + '<br>'
					+ "Coastal elements: estuary, lagoon" + '<br>' 
					+ "Download: " +
					'<a href="https://rest-coast.eu/storage/app/media/rest-coast-pilot-fact-sheetnahal-dalia4pages-1.pdf" target="_blank">Factsheet Nahal Dalia</a>' + '<br>'
					+ "Go to: " + 
					'<a href="' + linkNahal + '"target="_blank">Shared Directory</a>'
					+ '</div>';
		default:
			return '<div><strong>' + "New Pilot Location" + '</strong><br>' 
					+ "Go to: " + 
					'<a href="' + linkCustom + '"target="_blank">Shared Directory</a>'
					+ '</div>';;
	}
}

// Function to retrieve Coastal Unit's data
function openData(fileId) {
	// Log the operation in console
	console.log('Fetching the framework application data...');
	// The link to requested file
	const dataUrl = fileId;
	// Display the file in a new tab
	window.open(dataUrl, "_blank");				
}
		
// Function to check if a variable is a web link 
function isLink(variable) {
  // Regular expression to match URLs
  var urlRegex = /^(?:https?|ftp):\/\/[\w.-]+\.\w{2,}(?:\/\S*)?$/;
  // Test if the variable matches the URL regex
  return urlRegex.test(variable);
}

// Function to set a fixed geographical location for a specific polygon (top-right)
function polyLocater(polygon) {

	 // Get the coordinates of the polygon
	const coordinates = polygon.getLatLngs()[0];

	// Find the minimum latitude and longitude values
	const maxLat = coordinates.reduce((max, coord) => Math.max(max, coord.lat), coordinates[0].lat);
	const maxLng = coordinates.reduce((max, coord) => Math.max(max, coord.lng), coordinates[0].lng);

	return L.latLng(maxLat, maxLng);
}

// Polygon events
function assignPolygonEvents (polygon) {
	// Add mouseover event listener to show info window when mouse hovers over polygon
	 // Mouseover: show info box
	polygon.on('mouseover', function () {
		if (isEditPolygon || rightClickMenu) return;
		const content = "<div style='line-height:1.6; font-family: \"Times New Roman\", serif;'>" +
			"<p><strong>Coastal Unit: </strong>" + (this.options.delin || '') + "<br>" +
			"<strong>Restoration Process: </strong>" + (this.options.nbsBB || '') + "<br>" +
			"<strong>Restored Area: </strong>" + (-this.options.zIndex) + "ha</p>" + "</div>";
		const infoWindowLoc = polyLocater(this);
		this.infoPopup = L.popup({closeButton: false , className: 'infoBox' })
		 .setLatLng(infoWindowLoc)
		 .setContent(content)
		 .openOn(map);
	});

	// Add mouseout event listener to close info window when mouse leaves polygon
	// Mouseout: hide info box
	polygon.on('mouseout', function () {
		if (rightClickMenu) return;
		if (this.infoPopup && map.hasLayer(this.infoPopup)) {
			map.closePopup(this.infoPopup);
			this.infoPopup = null;
		}
	});
	
	// Add left-click event listener to the polygon
	// Left-click: open framework link
	polygon.on('click', function () {
	  if (isEditPolygon || rightClickMenu) return;
	  
	  if (isLink(this.options.nbsFW)) {
		openData(this.options.nbsFW);
	  } else {
		alert('Data file for the application of the NB3 Framework does not exist for ' + this.options.delin);
	  }
	});
							
	// Add richt-click event listener to the polygon
	// Right-click: custom context menu
	polygon.on('contextmenu', function (e) {
		if (isEditPolygon || rightClickMenu) return;
		
		L.DomEvent.preventDefault(e); // block browser’s native context menu
									
		if (this.infoPopup && map.hasLayer(this.infoPopup)) {
			map.closePopup(this.infoPopup);
			this.infoPopup = null;
		}
		
		const menu = '<div style="line-height:1.3; font-family: \"Times New Roman\", serif; font-style: italic; font-size: 14px;">' +
				'<div style="padding: 3px 3px; font-weight: bold; border-bottom: 1px solid #666;">' +
					'Coastal Unit: ' + this.options.delin + '</div>' +
				'<div style="padding: 3px 3px; cursor: pointer; border-bottom: 1px solid #ccc;"' +
					'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
					'onmouseout="this.style.backgroundColor=\'white\'" '+
					'onclick="editPolygon()">Edit Coastal Unit</div>' +
				'<div style="padding: 3px 3px; cursor: pointer; border-bottom: 1px solid #ccc;"' + 
					'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
					'onmouseout="this.style.backgroundColor=\'white\'" '+
					'onclick="editPoints()">Modify Coastal Unit</div>' +
				'<div style="padding: 3px 3px; cursor: pointer;" ' + 
					'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
					'onmouseout="this.style.backgroundColor=\'white\'" '+
					'onclick="deletePolygon()">Delete Coastal Unit</div>' + 
				'<div style="padding: 3px 3px; cursor: pointer;" ' + 
					'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
					'onmouseout="this.style.backgroundColor=\'white\'" '+
					'onclick="linkToPolygon()">Link to Coastal Unit</div>' + 
				'</div>';
				
		const menuWindowLoc = this.getBounds().getCenter();//polyLocater(this);
		this.menuPopup = L.popup({ closeButton: false , className: 'menuPopup' })
		 .setLatLng(menuWindowLoc)
		 .setContent(menu)
		 .openOn(map);
		
		selectedPolygon = this;
		rightClickMenu = true;
	});
}

// Marker events
function assignMarkerEvents (marker) {
	// Add event listener for marker mouseover
	// Mouseover → show popup with description
	marker.on('mouseover', function () {
		const description = getDescription(marker.options.title);
		const content = '<div><strong>' + marker.options.title + '</strong><br>' + description + '</div>';
		marker.bindPopup(content).openPopup();
	});
	
	// Add mouseout event listener
	// Mouseout: hide info box
	marker.on('mouseout', function () {
		setTimeout(() => {
			if (!marker.getPopup()._container.matches(":hover")) {
				marker.closePopup();
			}
		}, 200);
	});
	
	// Add event listener for marker left-click
	// Click → zoom to site, show polygons
	marker.on('click', function () {
		//map.setView([marker.getLatLng().lat, marker.getLatLng().lng], marker.zoomLevel);
		map.flyTo([marker.getLatLng().lat, marker.getLatLng().lng], marker.zoomLevel, {
			animate: true,
			duration: 1.5,
			easeLinearity: 0.25
		});
		map.closePopup();
		map.removeLayer(marker); // Hide marker
		
		activePilot = marker.options.title;
		// Add draw control once zoomed in
		removeDrawTools();
		addDrawTools();
		
		// Show polygons for this pilot
		polygons.forEach(function (poly) {
			if (poly.options.pilot === marker.options.title) {
				poly.addTo(map);
			}
		});
	});
}

// Function to check if coastal units at a specific pilot instersects 
function checkIntersection(atPilot) {
	
	// Filter the coastal units at pilot being checked
	var checkPolygons = polygons.filter(p => p.options && p.options.pilot === atPilot);
	
	// Set the display properties for each coastal unit at pilot 
	checkPolygons.forEach(function(checkP) {
		checkP.setStyle({
			color: '#08d600',
			opacity: 0.8,
			weight: 2,
			fillColor: '#56ff01',
			fillOpacity: 0.35
		});
		if (isEditPolygon) {
			checkP.setStyle({
				opacity: 0.4,
				fillOpacity: 0.1
			});
		}
	});
	
	if (checkPolygons.length <= 1) return; // nothing to intersect
	
	// Function to generate distinct colors to fill Coastal Units
	function generateColors(n) {
		const colors = [];
		for (let i = 0; i<n; i++) {
			const hue = Math.round((360/n)*i);
			colors.push(`hsl(${hue}, 70%, 50%)`);
		}
		return colors;
	}
	
	const numCU = new Set(checkPolygons.map(p => p.options.delin)).size;
	const colorP = generateColors(numCU);
	let colorInd = 0;
	
	// Check if there exists multiple coastal units at pilot			
	for (let i = 0; i < checkPolygons.length; i++) {
		for (let j = i + 1; j < checkPolygons.length; j++) {
			// Skip polygons in the same Coastal Unit
			if (checkPolygons[i].options.delin === checkPolygons[j].options.delin) continue;
			
			// Convert Leaflet polygons to Turf polygons
			const coords1 = checkPolygons[i].getLatLngs()[0].map(ll => [ll.lng, ll.lat]);
			const coords2 = checkPolygons[j].getLatLngs()[0].map(ll => [ll.lng, ll.lat]);
			// Close rings
			if (coords1[0][0] !== coords1[coords1.length - 1][0] || coords1[0][1] !== coords1[coords1.length - 1][1]) {
				coords1.push(coords1[0]);
			}
			if (coords2[0][0] !== coords2[coords2.length - 1][0] || coords2[0][1] !== coords2[coords2.length - 1][1]) {
				coords2.push(coords2[0]);
			}
			const poly1 = turf.polygon([coords1]);
			const poly2 = turf.polygon([coords2]);
			if (!poly1 || !poly2) {
				console.log("invalid polygons: ", checkPolygons[i].options.delin, poly1, poly2);
				continue;
			}
			// Check intersection
			try {
			  if (turf.intersect(poly1, poly2)) {
				const color = colorP[colorInd % colorP.length];
				checkPolygons[j].setStyle({ fillColor: color, color: color });
				colorInd++;
			  }
			} catch (err) {
			  console.warn(`Intersection failed at ${atPilot} for Coastal Unit ${checkPolygons[i].options.delin} and Coastal Unit ${checkPolygons[j].options.delin}. ${err}`);
			}
		}
	}			
}

// Function to open readme document in a new tab
async function openReadme() {
	// Check if Readme tab already exists, and if so, use this tab
	if (ReadmeTab && !ReadmeTab.closed) {
		ReadmeTab.focus();
		return;
	}
	
	ReadmeTab = window.open();
	const response = await fetch("https://raw.githubusercontent.com/c-arslan-wur/interactive-web-map/refs/heads/main/README.md");
	const markedTxt = await response.text();
	const markedHtml = marked.parse(markedTxt);
	
	ReadmeTab.document.write(`
		<html>
		<head>
			<title>About the Interactive Web Map</title>
			<link rel="stylesheet" href="libs/marked/github-markdown.css">
			<style>
				html, body {
					margin: 0;
					padding: 0;
					height: 100%;
					background: #c0c1c2;
				}
				
				body {
					display: flex;
					justify-content: center;
					align-items: flex-start;
					overflow-y: auto;
					padding: 2em;
				}
				
				.markdown-body {
					box-sizing: border-box;
					padding: 2em;
					max-width: 900px;
					width: 100%;
					background: rgb(60,60,60);
					border-radius: 8px;
					box-shadow: 0 2px 6px rgba(120,120,120,0.25);
				}
				
				img {
					max-width: 100%;
					height: auto;
				}
			</style>
		</head>
		<body>
			<article class="markdown-body">${markedHtml}</article>
		</body>
		</html>
	`);
	ReadmeTab.document.close();
}



