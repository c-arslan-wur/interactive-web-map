/*
	============================================================
	script.js — The Interactive Web Map | The NB³ Framework
	============================================================
	Main application script for the Interactive Web Map tool using 
	Leaflet rendering publicly available maps. Functionally decorated
	for enabling user interaction to work on geospatial data for 
	applying the NB³ Framework effectively.

	Author      : C. Arslan, 2025
	Affilitation: Wageningen University & Research
	Project     : EU H2020 REST-COAST
	Repository	: https://github.com/c-arslan-wur/interactive-web-map
	Contact     : cengiz.arslan@wur.nl

	Main functional inventory of the script includes:
		Loading existing NB³ Units	- REST-COAST, WATERLANDS, Local dir. etc.
		Loading new NB³ Units		- Zipped shape file or geojson
		Editing NB³ Unit metadata	- Pilot name, NbS process, link to dataset
		Editing NB³ Unit shape data	- Modifying vertices of polygons
		Deleting NB³ Unit			- Removing from existing Map
		Drawing new NB³ Units		- Leaflet drawing tool to create polygon
		Saving NB³ Units			- Storing all existing shapes as json
		Basemap layers				- Leaflet rendered ESRI Satellite, OSM etc.
		Informative map overlays	- Leaflet rendered layers for specific 
									  services from EMODnet and Copernicus

	Script structure:
		Section 1: Global Variables and Configuration
		Section 2: Page Setup and Button Event Listeners
		Section 3: Data Input — Loading shape files and shape drawing handling
		Section 4: Map Initialization
		Section 5: Handling User Interaction Events
		Section 6: Functions for Handling NB³ Unit Interactions
		Section 7: Utility and Helper Functions
	============================================================
*/

/* ============================================================
   SECTION 1 — GLOBAL VARIABLES & CONFIGURATION
   ============================================================
    
	Naming conventions used throughout:
	map*        — Leaflet map instance and map-level controls
	polygon*    — individual NB³ Unit polygon layers
	location*   — pilot-site location objects from JSON data
	pilot*      — pilot-site markers and names
	layer*      — Leaflet layer-control objects and overlays
	biotope*    — Copernicus / ESRI biotope overlay layers
	glob_*      — global lists shared across functions
	link*       — Google Drive shared-folder URLs
=============================================================== */

// Main Leaflet map instance initialized by initMap() - @type{L.map}
let map;
// Leaflet.draw toolbar control - @type{L.Control.Draw}
let drawControl;

// Interaction state: polygon is selected by right-click - @type{L.layer | null}
let selectedPolygon = null; 
// Interaction state: true when right-click context menu is open - @type{boolean}
let rightClickMenu = false;

// Active dataset mode set by each load button - @type{"rest-coast"|"waterlands"|"directory"|"new-map"|""}
let mapMode = "";

// Set true by addDrawEventListeners() while the draw toolbar is active - @type{boolean}
let drawingStart = false;

// Set true once a polygon has been completed via the draw toolbar - @type{boolean} 
let shapeCreated = false;

// Set true when the tool is opened via a direct URL with NB³ query parameters - @type{boolean}
let urlExists = false;

// Set true when vertices of a polygon are being edited via Leaflet-Geoman - @type{boolean}
let isEditPolygon = false;

// Zoom level for map overview on load or on reset - @type{number}
let originalZoom = 4;

// Geographic center for Europe-scale overview on load or on reset - @type{lat:number,lng:number}
let originalCenter = {lat: 49.0000, lng: 12.0000};

// Array for all NB³ Units as Leaflet layers currently rendered on the map - @type{L.Layer[]} 
let polygons = [];

// The full parsed JSON dataset for the active map mode, including an array of pilot objects each with an array of NB³ Units - @type{Object[]|undefined}
let locations;

// Array of Leaflet layers defining the spatial extent for upscaling projections for each NB³ Unit - @type{L.Layer[]}
let locationsCoords = [];

// Array of Leaflet markers representing pilot-site centroids: shown at overview zoom level, hidden when zoomed into - @type{L.Marker[]}
let pilotMarkers = [];

// Name of the pilot site currently zoomed into - @type{string|undefined}
let activePilot;

// List of all pilots in the active map mode used for populating dropdowns and initializing layer control groups - @type{string[]}
let glob_pilots = ["New Location"];

// Grouped layer control panel instance - @type{L.Control|null}
let layerControl = null;

// Base layer maps passed to the Leaflet layer control - @type{Object.<string, L.TileLayer}
let baseLayers = {};

// Overlay layer maps passed to the grouped layer control - @type{Object.<string, L.Layer}
let mapOverlays = {};

// Overlay layer maps for NB³ Unit's Baseline Ecological Status - @type{Object.<string, L.Layer}
let biotopeLayers = {};

// Reference to the README browser tab associated to the inline info button in h1 - @type{Window|null}
let ReadmeTab = null;

// URLs to the REST-COAST pilots' shared folders (Google Drive) - @type{string}
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

// Lookup table mapping pilot names to the corresponding Google Drive shared folders - @type{Object.<string, string>} 
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

/* ============================================================
   SECTION 2 — PAGE SETUP & BUTTON EVENT LISTENERS
   ============================================================
	Page load routine and all top-level button event listeners.

	Normal page load:
	1. window.onload fires → checks URL parameters → if exists,
	open a specific NB³ Unit directly (URL mode) → otherwise,
	call showConfirmationMessage() (welcome screen)
	2. User clicks a load button → call loadMap() for specific
	mapMode → initMap() with corresponding data

	Button → function map:
	RC  button  → mapMode="rest-coast"  → loadMap()	→ initMap(RC data)
	WL  button  → mapMode="waterlands"  → loadMap() → initMap(WL data)
	DIR button  → mapMode="directory"   → loadMap() → fileInput.click()
	MAP button  → mapMode="new-map"     → loadMap() → initMap(null)
	Load Shape  → shapefileInput.click() → Select zipped .shp or GEOJSON
	Reset View  → fly to originalCenter, restore markers
	Save Units  → saveJSONToFile() → All NB³ Units with formatted JSON
=============================================================== */

// Hide welcome/instructions screen immediately on script load
document.getElementById('confirmationMessage').style.display = 'none';

// Function to show welcome/instructions screen: nor URL parameters or map reset/page refresh
function showConfirmationMessage() {
	document.getElementById('confirmationMessage').style.display = 'block';
}

/** Start-up: URL-parameter mode check
	The tool allows for single NB³ Unit loading directed from a user-activated link for a specific NB³ Unit.
	
	If the page URL contains all three NB³ query parameters, skip the welcome screen and load matching NB³ Unit
	directly by extracting from the master JSON (src/NB3UnitsALL.json).
	
	URL format:
		?nb3L=<pilot name>&nb3U=<coastal unit code>&nb3P=<nbs process type> 
		(values are URI-encoded; matching is NFC-normalised, case- and whitespace-insensitive)
		
	If no URL parameters, then continue with welcome/instructions screen.
*/
window.onload = async function() {
	const params = new URLSearchParams(window.location.search);
	const pilot = params.get('nb3L') ? decodeURIComponent(params.get('nb3L')) : null;
	const cu = params.get('nb3U') ? decodeURIComponent(params.get('nb3U')) : null;
	const nbs = params.get('nb3P') ? decodeURIComponent(params.get('nb3P')) : null;
	
	if (pilot && cu && nbs) {
		// Normalize for minor encoding differences
		const pilotKey = pilot.normalize("NFC").toLowerCase().trim();
		const cuKey = cu.normalize("NFC").toLowerCase().trim();
		const nbsKey = nbs.normalize("NFC").toLowerCase().trim();
		
		try {
			// NB3UnitsALL.json served under /src is the master file covering all the existing NB³ Units.  
			// The repository owner is responsible for keeping it up to date.
			const response = await fetch("src/NB3UnitsALL.json");
			if (!response.ok) throw new Error("Requested JSON not found in src/");
			
			const JSONdata = await response.json();
			
			// Extract the specific NB³ Unit with a matching pilot, unit code, and NbS process combination.
			const JSONextract = JSONdata
				.filter(p => p.name.normalize("NFC").toLowerCase().trim() === pilotKey)
				.map(p => ({
					...p,
					NB3Units: p.NB3Units.filter(poly => 
						poly.delin &&
						poly.nbsBB &&
						poly.delin.normalize("NFC").toLowerCase().trim() === cuKey && 
						poly.nbsBB.normalize("NFC").toLowerCase().trim() === nbsKey
					)
				}))
				.filter(p => p.NB3Units.length > 0);
			
			urlExists = true; // Set global parameter for map view settings on load
			
			// Map loading routinge for the NB³ Unit: if not exists, display a warning.
			if (JSONextract.length > 0) {
				initMap(JSONextract);
			} else {
				alert(
					"The NB³ Unit cannot be loaded from URL!\n" +
					"Please contact the repository owner for an updated version."
				);
			}				
			return;
			
		} catch (err) {
			console.error("Error loading the NB³ Unit from URL: ", err);
			alert("Error loading shape! Please make sure the link is correct for the NB³ Unit.");
			window.close();
		}
	
	// No URL parameters: Show the welcome/instructions screen
	} else {
			showConfirmationMessage();
	}
};

// Authors' line (h2, style defined in CSS): On click, open readME.txt (served under /src) in a new browser tab.
document.querySelector("#authors span").addEventListener("click", function() {
	window.open("src/readMe.txt", "_blank");
});


/*	Dataset load buttons
	Each button sets mapMode (Rest-Coast, Waterlands, from directory, or blank map) and calls loadMap().
	Based on mapMode, loadMap() decides the fecthed JSON source, and then call initMap() with corresponding dataset.
*/

const fileInput = document.getElementById('fileInput');

// Load REST-COAST pilots' NB³ Units from src/NB3UnitsRC.json
const loadBtn = document.getElementById('load-locations-btn');
loadBtn.addEventListener('click', async () => {
	mapMode = "rest-coast";
	await loadMap();	
});

// Load WaterLANDS pilots' NB³ Units from src/NB3UnitsWL.json
const loadBtnWL = document.getElementById('load-locations-btn-WL');
loadBtnWL.addEventListener('click', async () => {
	mapMode = "waterlands";
	await loadMap();
});

// Load NB³ Units from a user-selected local JSON file
const loadBtnFile = document.getElementById('load-locations-btn-file');
loadBtnFile.addEventListener('click', async () => {
	mapMode = "directory";
	await loadMap();	
});

// Load a blank map with no pre-loader NB³ Units
const loadMapBtn = document.getElementById('load-new-locations-btn');
loadMapBtn.addEventListener('click', async () => {
	mapMode = "new-map";
	await loadMap();
});

// Main map loading routine for all four dataset modes and URL mode.
async function loadMap() {
	
	// Reset existing map with user-defined save operation.
	if (map) {			
		if ( polygons.length !== 0 ) {
			const saveFirst = confirm("Do you want to save existing NB³ Units before resetting the map?");

			if (saveFirst) {
				try {
					await saveJSONToFile(locations); 
				} catch (err) {
					console.error("Error saving file: ", err);
				}
			}
		} 
		
		// Destroy the Leaflet instance and hide the map container
		map.remove(); 
		document.getElementById('map').style.display = 'none';
		map = null; 
		
		// Reset all global variables to initial state
		polygons = [];
		locations = null;
		glob_pilots = ["New Location"];
		locationsCoords = [];
		pilotMarkers.length = 0;
		urlExists = false;
		
		// Show welcome/instructions screen
		showConfirmationMessage();
		
		// Disable buttons that are not functional on page load
		shapefileBtn.style.pointerEvents = 'none';
		shapefileBtn.style.opacity = '0.5';
		resetViewBtn.style.pointerEvents = 'none';
		resetViewBtn.style.opacity = '0.5';
		saveLocsBtn.style.pointerEvents = 'none';
		saveLocsBtn.style.opacity = '0.5';
 	}
	
	// Load dataset for the selected map mode
	if (mapMode === "rest-coast") {
		try {
			const response = await fetch("src/NB3UnitsRC.json");
			if (!response.ok) throw new Error("Default JSON not found in src/");
			const JSONdata = await response.json();
			document.getElementById('confirmationMessage').style.display = 'none';
			initMap(JSONdata);
			return;
		} catch (err) {
			console.error("Error loading REST-COAST pilots:", err);
			alert("Could not load REST-COAST map. Please select a .json file from directory");
		}
		
	} else if (mapMode === "waterlands") {
		try {
			const response = await fetch("src/NB3UnitsWL.json");
			if (!response.ok) throw new Error("Default JSON not found in src/");
			const JSONdata = await response.json();
			document.getElementById('confirmationMessage').style.display = 'none';
			initMap(JSONdata);
			return;
		} catch (err) {
			console.error("Error loading WaterLANDS pilots:", err);
			alert("Could not load WaterLANDS map. Please select a .json file from directory");
		}
		
	} else if (mapMode === "directory") {
		// Trigger the hidden file input
		fileInput.value = '';
		fileInput.click();
		fileInput.addEventListener('change', () => {
			document.getElementById('confirmationMessage').style.display = 'none';
		}, {once: true});
		return;
		
	} else if (mapMode === "new-map") {
			document.getElementById('confirmationMessage').style.display = 'none';
			initMap(null);
			return;
	}
}

/** File input handler for the directory mode:
	
	Triggered by fileInput.click() inside loadMap() for mapMode = "directory".
	
	Reads the user-selected JSON file and passes the parsed data to initMap().
	
	Resets after reading for enabling re-selection in subsequent button activation.
*/
fileInput.addEventListener('change', function onFileChange(e) {
	const file = e.target.files && e.target.files[0];
	
	if (!file) {
		console.warn('File selection cancelled by user.');
		fileInput.value = '';
		return;
	}
	
	const reader = new FileReader();
	reader.onload = function(event) {
		try {
			document.getElementById('confirmationMessage').style.display = 'none';
			const jsonData = JSON.parse(event.target.result);
			initMap(jsonData);
		} catch (error) {
			console.error('Error parsing JSON:', error);
			alert('Invalid file format. Please select a valid JSON file.');
		} finally {
			// Reset to enable re-selection of the same file next time
			fileInput.value = '';
		}
	};
	reader.readAsText(file);	
});

/*	Handle loading shape file: 
	
	Users can load existing shape files as their candidate NB³ Units.
	
	Suitable shape file formats:
	- zipped .shp files
	- JSON or GeoJSON
*/
const shapefileBtn = document.getElementById('file-select-btn');
const shapefileInput = document.getElementById('shapefileInput');

// Disabled by default: Only active when a map is loaded
if (!map || polygons.length === 0) {
	shapefileBtn.style.pointerEvents = 'none';
	shapefileBtn.style.opacity = '0.5';
}

// Proxy click: Button triggers the hidden file input
shapefileBtn.addEventListener("click", () => {
	shapefileInput.click();
});

// Call the appropriate shape file handler function based on the selected file type
shapefileInput.addEventListener("change", event  => {
	const shapefile = event.target.files[0];
	
	if (!shapefile) {
		alert('File selection cancelled by user.');
		event.target.value = "";
		return;
	}
	
	
	const ext = shapefile.name.split('.').pop().toLowerCase();
    if (ext === "geojson" || ext === "json") {
        handleGeoJsonFile(shapefile);
    } else if (ext === "zip") {
        handleShapefile(shapefile);
    } else {
        alert("Unsupported file type. Please upload a .geojson or .zip shapefile.");
    }

    event.target.value = ""; // reset for re-selection next time
});

/*	Reset view button
	
	Flies the map back to the Europe-scale overview, restores all pilot markers, 
	hides all NB³ Units, removes the draw toolbar, and clears any biotope overlays.

	flyTo() for a smooth animated transition from pilot zoom.
	
	Uses globally defined zoom level and central coordinates.
*/	
const resetViewBtn = document.getElementById('reset-view-button');

// Disabled by default: Only active when a map is loaded
if (!map || polygons.length === 0) {
	resetViewBtn.style.pointerEvents = 'none';
	resetViewBtn.style.opacity = '0.5';
}

resetViewBtn.addEventListener('click', function() {
	activePilot = "";
	
	// Fly back to the default overview 
	map.flyTo([originalCenter.lat, originalCenter.lng], originalZoom, {
		animate: true,
		duration: 1.5,
		easeLinearity: 0.25
	});
	
	// Restore all pilot markers
	pilotMarkers.forEach(marker => {
		if (!map.hasLayer(marker)) marker.addTo(map);
	});
	
	// Hide overlays for upscaling boundaries
	locationsCoords.length && locationsCoords.forEach(poly => {
		if (map.hasLayer(poly)) map.removeLayer(poly);
	});
	
	// Hide NB³ Units
	polygons.forEach(poly => {
		if (map.hasLayer(poly)) map.removeLayer(poly);
	});

	// Hide draw control
	removeDrawTools();
	
	// Clear any active biotope overlays
	resetBiotopes();
	
});

/*	Save NB³ Units button
	
	Saves the current dataset as a formatted JSON with a timestamp.
	
	Users define the directory on local drive.
	
	NOTE: Read welcome/instructions screen on page load/refresh for guidance on how to handle saved dataset.	
*/	
const saveLocsBtn = document.getElementById('save-locations-btn');

// Disabled by default: Only active when a map is loaded
if (!map || polygons.length === 0) {
	saveLocsBtn.style.pointerEvents = 'none';
	saveLocsBtn.style.opacity = '0.5';
}

// Guard against duplicate listener registration
if (!saveLocsBtn.dataset.bound) {
	saveLocsBtn.addEventListener('click', async () => {
		try{
			await saveJSONToFile(locations);
		} catch (err) {
			if (err.name === "AbortError") {
				console.log("Save cancelled by user.");
			} else {
				console.error("Error saving: ", err);
			}
		}
	});
	saveLocsBtn.dataset.bound = "true";
}

/**	Save helper function:

	Tranforms dataset to a formatted JSON file and prompts user to save this file in a local directory.
	
	Formats filename using a timestamp: NB3Units_YYYY-MM-DD_HHhMMm.json
	Timestamp acts as a version identifier for the users and the repository owner.
*/
async function saveJSONToFile(data) {
	// Build a timestamp string for the filename
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, "0"); 
	const dd = String(now.getDate()).padStart(2, "0");
	const hh = String(now.getHours()).padStart(2, "0");
	const mi = String(now.getMinutes()).padStart(2, "0");
	const fileName = `NB3Units_${yyyy}-${mm}-${dd}_${hh}h${mi}m.json`;
	
	const options = {
		suggestedName: fileName,
		types: [
			{
				description: "JSON Files",
				accept: {"application/json": [".json"]}
			}
		]
	};
	
	// Format with 2-space indentation for human-readable output
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	
	// Open the native Save dialog
	const fileHandle = await window.showSaveFilePicker(options);
	const writableStream = await fileHandle.createWritable();
	await writableStream.write(blob);
	await writableStream.close();
	
	console.log('File saved successfully:', fileName);
}

/* ============================================================
   SECTION 3 — DATA I/O: SHAPEFILE AND DRAW SHAPE HANDLING
   ============================================================
	Functions for loading external as well as user-drawn NB³ Units 
	as spatial overlays onto the map. These are distinct from the
	existing JSON datasets for NB³ Units—handled by loadMap() → initMap().
	Users define an NB³ Unit from scratch building on the imported
	or drawn spatial overlay during participative sessions.

	Call chain for overlay loading:
	shapefileBtn click
		└─ shapefileInput.change (Section 2)
			├─ handleShapefile()        → shp.js → createPolygonsFromGeoJson()
			└─ handleGeoJsonFile()      → JSON.parse → createPolygonsFromGeoJson()
											├─ closeRings()      	(this section)
											├─ showModal()       	(this section)
											├─ assignMarkerEvents() (Section 5)
											├─ assignPolygonEvents()(Section 5)
											├─ checkIntersection() 	(Section 5)
											└─ reorderPolygons() 	(this section)

	Functions in this section:
		handleShapefile(file)            — reads zipped Shapefile via shp.js
		handleGeoJsonFile(file)          — reads JSON/GeoJSON text file
		closeRings(rings)                — geometry validation: closes polygon rings 
		createPolygonsFromGeoJson(data)  — imports polygons as NB³ Units from features
		reorderPolygons(pilot)           — sorts polygons by area for correct rendering
		
	Call chain for overlay drawing:
	drawControl click
		└─ L.Draw.Event.DRAWSTART			→ User starts drawing a polygon
			└─ ESC or Cancel		    	
				└─ L.Draw.Event.DRAWSTOP	→ User finishes without completion
			└─ Finish		    	
				└─ L.Draw.Event.CREATED		→ User completes a polygon
												├─ removeDrawTools() (this section)
												├─ showModal()       (this section)
												├─ assignMarkerEvents() (Section 5)
												├─ assignPolygonEvents() (Section 5)
												├─ checkIntersection() 	(Section 5)
												├─ reorderPolygons() (this section)
												└─ addDrawTools()    (this section)					
											
	Functions in this section:
		addDrawTools()		            — Leaflet draw control: Create and add to map 
		removeDrawTools()		        — Leaflet draw control: remove from map
		addDrawEventListeners()			— Register draw event listeners 
=============================================================== */


/*	Function to handle zipped .shp files:
	
	Required shape file components in .zip: .dbf, .prj, .shp, .shx
	
	Uses shp.js library to create GEOJSON input for createPolygonsFromGeoJson().
	
	The file is read as an ArrayBuffer (required by shp.js).
*/	
function handleShapefile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        shp(e.target.result)
            .then(function (geojson) {
                createPolygonsFromGeoJson(geojson);
            })
            .catch(function (err) {
                console.error("Invalid .shp:", err);
                alert(
					"Error: The selected file is not a valid .zip.\n"+
					"Please ensure the archive contains .dbf, .prj, .shp, and .shx files."
				);
            });
    };
    reader.readAsArrayBuffer(file);
}

/*	Function to handle JSON/GeoJSON files:

	Parses the selected .json or .geojson files as input to createPolygonsFromGeoJson().
	
	The file is read as text (standard for JSON).
*/	
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


/* 	Geometry helper function:
	
	Validates and closes an array of polygon rings imported from shape files.
	
	Required for proper rendering as Leaflet polygon layers.
	
	A valid ring must:
		- have at least 3 coordinates (minimum a triangle).
		- have at least 3 unique vertices (no degenerate shapes).
		- be closed—first and last coordinate must be identical.
		
	Invalid rings except the unclosed ones are filtered out.
	
	Suitable rings are closed by appending the first coordinate.
*/	
function closeRings(rings) {
	return rings
		.map(ring => {
			// Reject rings with fewer than 3 coordinates
			if (!ring || ring.length < 3) return null;
			
			// Close rings with different first and last points
			const first = ring[0];
			const last = ring[ring.length - 1];
			if (first.lat !== last.lat || first.lng !== last.lng) {
				ring = [...ring, first];
			}
			
			// Reject degenerate rings with fewer than 3 unique vertices
			const uniqueVertices = new Set(ring.slice(0, -1).map(p => `${p.lat}, ${p.lng}`));
			if (uniqueVertices.size < 3) return null;
			// Reject rings with fewer than 3 coordinates after closure
			if (ring.length <4) return null;
			
			return ring;
		})
		.filter(Boolean); // Remove nulls
}

/*	Function to import each polygon in GeoJSON data as NB³ Unit:

	Operates on the FeatureCollection in GeoJSON data by processing each feature-
	one at a time via recursive nextFeat() pattern-to display the modal for metadata
	entry point during participative processes. 
	
	Supports both Polygon and MultiPolygon geometry types.

	Guarded against importing identical NB³ Units: overwriting coordinates or replace shape
	
	Operations on each GeoJSON feature:
		- Coordinate conversion		→ GeoJSON's [lng, lat] to Leaflet's {lat, lng}
		- Closed ring validation 	→ closeRings()
		- Polygon area calculation	→ Turf.js library → passed as negative zIndex for later rendering
		- User metadata entry 		→ showModal() (Section 5)
		- Polygon stored as global	→ metadata written into 'locations' object; shape pushed into 'polygons' array
*/	
function createPolygonsFromGeoJson(data) {

	const features = data.features || [];
	if (features.length === 0) {
		console.error('No features found in GeoJSON data.');
		return;
	}
	
	let indexFeat = 0;	// tracks features
	let forPilot;		// stores pilot for post-loop process
	
	/** 
		Processing one feature at a time, recursively called via showModal callback for sequential
		modal display for metadata entry per feature.
		
		No user interaction until all the features are processed.
	*/
	function nextFeat() {
		
		// End recursion if all features are processed.
		if (indexFeat >= features.length) {
			isEditPolygon = false;
			toggleButtons(true);
			if (activePilot !== "") { addDrawTools() };
			checkIntersection(forPilot);	// checks intersection for display color change
			return;
		}
		
		
		const feature = features[indexFeat];
		indexFeat++;
		
		// Disable user interaction while features are being processed.
		isEditPolygon = true;
		toggleButtons(false);
		removeDrawTools();
		
		const geometry = feature.geometry;
		if (!geometry || !geometry.type) {
			console.error("Invalid geometry for feature:", feature);
			return;
		}
		
		// Convert coordinates to Leaflet format, and then validate, and close rings
		const polygonsLoaded = [];
		if (geometry.type === "Polygon") {
			polygonsLoaded.push(closeRings(geometry.coordinates.map(ring => ring.map(coord => ({ lat: coord[1], lng: coord[0] })))));
		} else if (geometry.type === "MultiPolygon") {
			geometry.coordinates.forEach(coords =>  {
				polygonsLoaded.push(closeRings(coords.map(ring => ring.map(coord => ({ lat: coord[1], lng: coord[0] })))));
			});
		}
		
		// Create Leaflet polygons from the feature in progress and calculate its total area
		const newCU = [];
		let areaCU = 0;
		polygonsLoaded.forEach(coords => {
			// Leaflet polygon rendering on map
			const polygon = L.polygon(coords).addTo(map);
			newCU.push(polygon)	
			// Area calcuation using Turf.js library (requires [lng, lat] order)
			const tempCoord = coords.map(ring => ring.map(ll => [ll.lng, ll.lat])); // GeoJSON format: [lng, lat]
			const turfPoly = turf.polygon(tempCoord);	
			areaCU += turf.area(turfPoly); 	
		});	
		const areaHa = Math.round(areaCU / 10000); // Area conversion to hectares 
		
		/**
			Metadata modal
			User confirmation fires the callback, enabling recursion on all features.
			Globals are updated inside the callback, ensuring the proper capture of user input data.
		*/
		showModal((pilot, delin, nbsBB, nbsFW) => {
			
			// Create pilot site entry for 'locations' if it does not yet exist
			if (!locations.find(item => item.name === pilot)) {
				const newPilot = {
					name: pilot,
					location: { 
						lat: turf.centroid(feature).geometry.coordinates[1], 
						lng: turf.centroid(feature).geometry.coordinates[0]
					},
					zoom: 13,
					NB3Units: []
				};
				locations.push(newPilot);

				// Insert new pilot before the last entry ("New Location") in glob_pilots
				glob_pilots.splice(glob_pilots.length - 1, 0, pilot);

				// Attach pilot site description from lookup table
				newPilot.description = getDescription(newPilot.name);
				
				// Create and store a pilot marker
				const marker = L.marker(
					[newPilot.location.lat, newPilot.location.lng],
					{title: newPilot.name}
				);
				marker.zoomLevel = newPilot.zoom;
				pilotMarkers.push(marker);
				assignMarkerEvents(marker);
			}
			
			// Handle duplicate NB³ Unit entry: let user either overwrite coordinates or replace shape
			const existing = polygons.filter(p => p.options.pilot === pilot && p.options.delin === delin);
			const targetPilot = locations.find(item => item.name === pilot);
			const existingCU = targetPilot.NB3Units.find(cu => cu.delin === delin);
			
			if (existing.length > 0) {
				const confirmOverwrite = confirm(
					`NB³ Unit for location "${pilot}" with delineation "${delin}" already exists.\n\n` +
					`Do you want to overwrite the shape?\n\n` +
					`OK     → overwrite coordinates only (keep existing metadata)\n` +
					`Cancel → replace entire unit with new shape and metadata`
				);
				
				// Remove old NB³ Unit from map and global 'polygons' array
				existing.forEach(p => {
					map.removeLayer(p);
					polygons.splice(polygons.indexOf(p), 1);
				});
				
				if (confirmOverwrite) {
					// Overwrite: keep existing metadata and only update coordinates
					const polyOpt = {
						pilot: existing[0].options.pilot,
						delin: existing[0].options.delin,
						nbsBB: existing[0].options.nbsBB,
						nbsFW: existing[0].options.nbsFW
					};
					newCU.forEach(polygon => {
						Object.assign(polygon.options, polyOpt);
						polygon.options.zIndex = -areaHa;
						assignPolygonEvents(polygon);
						polygons.push(polygon);
					});
					// Update coordinates also in the global 'locations' object: Main GeoJSON dataset							
					existingCU.coords = newCU.map(poly => closeRings(poly.getLatLngs())[0].map(ll => ({ lat: ll.lat, lng: ll.lng })));
					
				} else {
					// Replace: new medatadata (user input in the modal) and new coordinates
					newCU.forEach(polygon => {
						Object.assign(polygon.options, { pilot, delin, nbsBB, nbsFW });
						polygon.options.zIndex = -areaHa;
						assignPolygonEvents(polygon);
						polygons.push(polygon);
					});
					// Update both metadata and coordinates in the global 'locations' object: Main GeoJSON dataset
					existingCU.delin = delin;
					existingCU.nbsBB = nbsBB;
					existingCU.nbsFW = nbsFW;
					existingCU.coords = newCU.map(poly => closeRings(poly.getLatLngs())[0].map(ll => ({ lat: ll.lat, lng: ll.lng })));
				}
				
			} else {
				// New NB³ Unit: new medatadata (user input in the modal) and new coordinates 
				newCU.forEach(polygon => {
					Object.assign(polygon.options, { pilot, delin, nbsBB, nbsFW });
					polygon.options.zIndex = -areaHa;
					assignPolygonEvents(polygon);
					polygons.push(polygon);
				});
				// Create new entry in the global 'locations' object: Main GeoJSON dataset
				targetPilot.NB3Units.push({
				  delin,
				  nbsBB,
				  nbsFW,
				  shp: false,
				  coords: newCU.map(poly => closeRings(poly.getLatLngs())[0].map(ll => ({ lat: ll.lat, lng: ll.lng })))
				});
			}
			
			// Sort polygons based on area and process the next feature: Important for rendering sequence for Leaflet layers
			forPilot = pilot;
			reorderPolygons(forPilot);
			nextFeat();
		});				
	}
	
	nextFeat();	// starting the sequential feature processing loop
}

/*	Function to reorder NB³ Units:

	Sorts NB³ Units within a pilot site by area in ascending order.
	
	After each sort operation, NB³ Units are re-rendered so that units with larger areas
	appear behind smaller ones on the map.
	
	Purpose: Bypassing the Leaflet rendering rule based on the order of addition to the map.
	This results in larger shapes blocking the smaller shapes added before them. This 
	function corrects this by bringing smaller units to front, ensuring user interaction.
*/
function reorderPolygons(pilot) {
	// Find indeces of all polygons belonging to this pilot
	const indFilter = polygons
		.map((p, i) => (p.options.pilot === pilot ? i : -1))
		.filter(i => i !== -1);

	// Check if sorting is needed
	if (indFilter.length <= 1) return;
	
	// Sort the polygons by zIndex (-area): largest area first
	const polyFilter = indFilter.map(i => polygons[i]);
	polyFilter.sort((p1,p2) => p1.options.zIndex - p2.options.zIndex);
	
	// Place sorted polygons back to their original positions in global 'polygons' array 
	indFilter.forEach((idx, i) => {
		polygons[idx] = polyFilter[i];
	});
	
	// Re-render sorted polygons by bringing each to front: last called ends up on top
	polyFilter.forEach(p => {
		if (p._map) p.bringToFront();
	});
}

/*	Routine for drawing new polygon to be registered as NB³ Unit:

	Manages the Leaflet.draw toolbar and handles the creation of a user-drawn NB³ Unit.
	
	Includes:
		- function to add draw control dynamically
		- function to remove draw control dynamically
		- function to add draw event listeners
		
	Excludes draw event listeners from dynamic draw control visibility settings to ensure
	one time event listener registration.
	
	Once the draw action is complete, displays the modal for metadata entry point 
	during participative processes
*/	

/** Function for adding draw control:
	
	Creates and adds Leaflet.draw toolbar if it does not yet created.
	
	Activates only polygon creation: NB³ Units as polygon features.
	
	Draw tool control is created once and reused to avoid duplicate controls.
	
	Polygon editing through Leadlet is disabled: Handled by Leaflet-Geoman.
*/
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

/** Function for removing draw control:
	
	Removes the existing Leaflet.draw toolbar from the map.
	
	Inhibits unintentional activation in undesried states, e.g. map reset, shape file loading...
*/
function removeDrawTools() {
	if (drawControl) {
		map.removeControl(drawControl);
	}
}

/**	Function for adding draw event listeners:
	
	Called once during the map setup, independent of the dynamic draw control toolbar visibility.
	
	Builds on three event listeners:
		- L.Draw.Event.DRAWSTART	→	User activates the draw tool:
											- Disable user interaction buttons
											- Freeze polygon interaction
		- L.Draw.Event.DRAWSTOP		→	User cancels the drawing:
											- Activate user interaction buttons
											- Enable polygon interaction
		- L.Draw.Event.CREATED		→	User completes the drawing:
											- Display metadata modal entry
											- Wait until modal confirmation
											- Upon confirmation:
												- Register new NB³ Unit
												- Activate user interaction buttons
												- Enable polygon interaction

*/
function addDrawEventListeners() {
	
	// DRAWSTART: User activates the draw tool
	map.on(L.Draw.Event.DRAWSTART, function () {
		drawingStart = true;
		shapeCreated = false;
		isEditPolygon = true;
		toggleButtons(false);
		checkIntersection(activePilot);
	});
	
	// DRAWSTOP: User cancels the drawing
	// shapeCreated flag signals finishing without completion.
	map.on(L.Draw.Event.DRAWSTOP, function () {
		if (drawingStart && !shapeCreated) {
			isEditPolygon = false;
			toggleButtons(true);
			checkIntersection(activePilot);
		}
		drawingStart = false;
	});
	
	// CREATED: User completes a polygon
	map.on(L.Draw.Event.CREATED, function(event) {
		
		shapeCreated = true;
	
		// Remove draw control: polygon created but user input modal is active
		removeDrawTools();
		
		// Add polygon on map: visible for users during user input modal is active
		const polygon = event.layer;
		polygon.addTo(map);
		
		// Metadata modal
		// User confirmation fires the callback with user input for parameter names.
		showModal(function (pilot_site, delineation, building_block, framework) {
			
			// Create pilot site entry for 'locations' if it does not yet exist
			if (!locations.find(item => item.name === pilot_site)) {
				const feature = polygon.toGeoJSON();
				const newPilot = {
					name: pilot_site,
					location: {
						lat: turf.centroid(feature).geometry.coordinates[1], 
						lng: turf.centroid(feature).geometry.coordinates[0]
					},
					zoom: 13,
					NB3Units: []
				};
				locations.push(newPilot);
				
				// Insert new pilot before the last entry ("New Location") in glob_pilots
				glob_pilots.splice(glob_pilots.length - 1, 0, pilot_site);
				
				// Attach pilot site description from lookup table
				newPilot.description = getDescription(newPilot.name);
				
				// Create and store a pilot marker
				const marker = L.marker(
					[newPilot.location.lat, newPilot.location.lng],
					{title: newPilot.name}
				);
				marker.zoomLevel = newPilot.zoom; 
				pilotMarkers.push(marker);
				assignMarkerEvents(marker);
			}			
			
			// Assign metadata (user input in the modal) to polygon options
			polygon.options.pilot = pilot_site;
			polygon.options.delin = delineation;
			polygon.options.nbsBB = building_block;
			polygon.options.nbsFW = framework;

			// Calculate area
			//	- Transform from Leaflet format to GeoJSON Format
			//	- Explicitly close ring
			//	- Calculate area and convert to hectares
			//	- Assign as negative zIndex for render order
			const coords = polygon.getLatLngs()[0].map(ll => [ll.lng, ll.lat]);
			coords.push(coords[0]);
			const turfPoly = turf.polygon([coords]);
			const areaHa = Math.round(turf.area(turfPoly) / 10000);
			polygon.options.zIndex = -areaHa;

			// Assign polygon events and store in global 'polygons' array as new NB³ Unit 
			assignPolygonEvents(polygon);
			polygons.push(polygon);
			
			// Create new entry in the global 'locations' object: Main GeoJSON dataset
			const newUnit = {
				delin: delineation,
				nbsBB: building_block,
				nbsFW: framework,
				shp: false,
				coords: polygon.getLatLngs()[0].map(ll => ({ lat: ll.lat, lng: ll.lng }))
			};
			let targetPilot = locations.find(item => item.name === pilot_site);
			if (targetPilot) {
				targetPilot.NB3Units.push(newUnit);
			}

			// Reset user interaction
			isEditPolygon = false;
			toggleButtons(true);
			addDrawTools();
			
			// Check any intersection with existing NB³ Units within the pilot and sort based on area for proper rendering
			checkIntersection(pilot_site);
			reorderPolygons(pilot_site);
		});
		
	});	
}

/* 	Function for modal dialogue
	
	Creates the metadata entry for for the spatial overlays to identify new NB³ Units
	during participatory process.
	
	Designed to work in two contexts properly:
	
		1. Load shape file: A polygon is loaded as either zipper .shp or GeoJSON.
		The modal facilitates user input as metadata for the shape. Defining a new
		pilot site is possible by selecting "New Location" from the dropdown list.
		
		2. Draw shape: A polygon is drawn by users. If users collaborate in a
		pre-defined pilot site, the modal is locked to that pilot, which is validated
		on submit.
		
	Modal fields:
		- dropdown	→ Pilot Site Name (from glob_pilots)
		- textField	→ NB³ Unit Code
		- textField	→ NbS Restoration Process
		- textField	→ Link to NB³ Unit's dataset (Google Drive)
		- textField	→ Pilot Site Name (hidden - only for "New Location")
*/
function showModal(callback) {
	// Create modal container
	const modalContainer = document.createElement("div");
	modalContainer.className = "modal";
	
	// Create modal content
	const modalContent = document.createElement("div");
	modalContent.className = "modal-content";
	
	// Header field
	const heading = document.createElement("h3");
	heading.textContent = "Select the location of interest:";
	modalContent.appendChild(heading);
	
	// Create horizontally aligned field for dropdown, button, and tip text 
	const dropdownWrapper = document.createElement("div");
	dropdownWrapper.style.display = "flex";
	dropdownWrapper.style.alignItems = "center";
	dropdownWrapper.style.gap = "10px";

	// Dropdown menu populated from glob_pilots
	const dropdown = document.createElement("select");
	dropdown.id = "dropdown";
	
	const dflt = document.createElement("option");
	dflt.value = "";
	dflt.disabled = true;
	dflt.selected = true;
	dflt.textContent = "Select location";
	dropdown.appendChild(dflt);
	
	glob_pilots.forEach(pilot => {
		const option = document.createElement("option");
		option.value = pilot;
		option.textContent = pilot;
		dropdown.appendChild(option);
	});
	modalContent.appendChild(dropdown);
	
	// "Link to Shared Folder" Button — Opens Google Drive folder for the selected pilot
	const infoButton = document.createElement("button");
	infoButton.textContent = "Link to Shared Folder";
	infoButton.disabled = true;
	infoButton.title = "Go to the shared folder of the selected location!"
	
	infoButton.addEventListener("click", () => {
		if (activePilot !== "" && dropdown.value !== activePilot && dropdown.value !== "New Location") {
			alert("Please verify the selected location!");
			return;
		}
		const folderUrl = linksToSharedFolders[dropdown.value] || linksToSharedFolders["New Location"];
		window.open(folderUrl, "_blank");
	});
	
	// Tip text — Guides the user on how to get the link to the dataset
	const tipText = document.createElement("span");
	tipText.innerHTML = 'Go to the shared folder to select the framework application data and copy the link below.<br>' +
						'Please use e.g. "The NB³ Instance newUnit1" if a new NB³ Unit is created.';
	tipText.style.color = "#003366";
	tipText.style.fontStyle = "italic";
	tipText.style.fontSize = "14px";
	tipText.style.marginLeft = "5px";
	tipText.style.display = "none"; 
	
	// Dropdown chnage handler — Makes button and tip text visible on pilot selection
	dropdown.addEventListener("change", () => {
		infoButton.disabled = dropdown.value === "";
		tipText.style.display = dropdown.value === "" ? "none" : "inline";
		textFieldHeading.style.display = dropdown.value === "New Location" ? 'block' : "none";
		textField.style.display = dropdown.value === "New Location" ? 'block' : "none";
	});
	
	// Assemble the dropdown row
	dropdownWrapper.appendChild(dropdown);
	dropdownWrapper.appendChild(infoButton);
	dropdownWrapper.appendChild(tipText);
	modalContent.appendChild(dropdownWrapper);
	
	// Custom pilot name field ("New Location" only) — Hidden by default 
	const textFieldHeading = document.createElement("h4");
	textFieldHeading.textContent = "Location Name";
	textFieldHeading.style.display = "none";
	const textField = document.createElement("input");
	textField.type = "text";
	textField.id = "textField4";
	textField.placeholder = "e.g. Gediz Delta";
	textField.style.display = "none";
	modalContent.appendChild(textFieldHeading);
	modalContent.appendChild(textField);
		
	// Create NB³ Unit metadata fields
	let inputs = [
		{ 
			header: "NB³ Unit Code: ", 
			id: "textField1", 
			placeholder: "e.g. CU#1" 
		},
		{ 
			header: "NbS-driven Restoration Process: ", 
			id: "textField2", 
			placeholder: "e.g. Salt marsh revegetation" 
		},
		{ 
			header: "Link to the framework application data (shared directory): ", 
			id: "textField3", 
			placeholder: "https://..."
		}
	];
	inputs.forEach(input => {
		const textFieldHeading = document.createElement("h4");
		textFieldHeading.textContent = input.header;
		
		const textField = document.createElement("input");
		textField.type = "text";
		textField.id = input.id;
		textField.placeholder = input.placeholder;
		
		modalContent.appendChild(textFieldHeading);
		modalContent.appendChild(textField);
	});
					
	// Create Submit button — Validates input, removes the modal, and fires the callback
	const submitButton = document.createElement("button");
	submitButton.textContent = "Submit";
	
	submitButton.addEventListener("click", function() {
		
		// Validation: If users have zoomed into a specific pilot, the dropdown must match it
		if (activePilot ) {
			if (!dropdown.value || dropdown.value !== activePilot) {
				alert("Please verify the selected location!");
				return;
			}
		} else {
			// Ensure metadata in a specific (user-selected) pilot site.
			if (!dropdown.value) {
				alert("Please verify the selected location!");
				return;
			}
		}
		
		// Assign callback parameters from user-defined input
		const pilot_name = dropdown.value === "New Location" ? document.getElementById("textField4").value : dropdown.value;
		const delineation = document.getElementById("textField1").value || "";
		const building_block = document.getElementById("textField2").value || "";
		const framework = document.getElementById("textField3").value || "";
		
		// Remove modal and fire the callback with metadata values
		document.body.removeChild(modalContainer);
		callback(pilot_name, delineation, building_block, framework);
	});
	
	modalContent.appendChild(submitButton);
	
	// Append all modal content to modal container and insert it before the map container.
	modalContainer.appendChild(modalContent);	
	document.body.insertBefore(modalContainer,document.getElementById("map"));
	
}

/* ============================================================
   SECTION 4 — MAP INITIALISATION
   ============================================================
	This is the foundational function for the Interactive Web Map tool,
	where Leaflet library is used for setting up an interactive map based
	on the input parsed JSON data (or null for a blank map).

	This section handles:
		└─ Seeting up the map container with base layers
			├─ Leaflet map instance		
			└─ Base tile layers
				├─ OSM: Open Street Map
				├─ OSM Topo: Topographic maps for Open Street Map		
				└─ ESRI Satellite: Satellite imagery from ArcGIS
		└─ Setting up the Leaflet pane for auxilliary overlay layers
			├─ ESRI service: Displays labels for ESRI Satellite base map 		
			└─ EMODNet services: Import data layers from EMODnet marine datasets (across Europe)
				├─ NATURA2000 sites: Network of marine Natura 2000 sites (Birds and Habitats Directive)
				├─ Bathymetry - mean depth: Average depth of water column		
				├─ Bathymetry - contours: Isobaths based on average depth - 50, 100, 200, 500, 1000, 2000, and 5000 m
				├─ Coastline - Lowest Astronomical Tide: Vector line showing coastline for LAT 
				├─ Coastline - Mean Sea Level: Vector line showing coastline for MSL
				├─ Coastline - Mean High Water: Vector line showing coastline for MHW
				├─ Coastal Migraiton - Field Data: Shoreline change 2007-2017 distinguishing areas of erosion and accretion
				├─ Waste Disposal - Discharge Points: Dataset on coastal discharge points
				├─ Dredging: Dataset on dredging areas
				├─ Vessel Density - All Types: Monthly density of vessel trafic in hours per square km
				├─ Seagrass Cover in Europe (2025): Current known extent and distribution of seagrass meadows in EU Waters
				└─ Coastal Wetlands in European Waters (2025): Current known extent and distribution of coastal wetland type (Ramsar Classification)
			└─ Copernicus services: Import data layers from Copernicus Earth observation datasets (across Europe)
				├─ NATURA 2000 Network: Network of Natura 2000 areas (Birds and Habitats Directive)
				├─ Water and Wetness Status 2018: Occurance of water and wet surfaces over 2012-2018		
				├─ CORINE Land Cover: Raster images for inventory of 44 thematic classes based on classification of satellite images
					├─ 1990: Land cover / land use status of year 1990 
					├─ 2000: Land cover / land use status of year 2000
					├─ 2006: Land cover / land use status of year 2006
					├─ 2012: Land cover / land use status of year 2012
					└─ 2018: Land cover / land use status of year 2018
			└─ Biotopes: Imports (if exists) the inventory of habitat maps according to latest EUNIS classifications in a specific pilot site
		├─ Loading parsed JSON dataset (null for blank map)
		└─ Finalizing the setup for user interaction 
				
	Functions defined within the section (for closure access):
		getEmodNet()           		— Builds an overlay object with a WMS request for EMODNet layers 
		toggleEMODnetLayers()  		— Overlay control to hide/show available EMOODnet layers
		getLatestData()        		— Adhoc function to filter most-recent data per site for WFS features
		propertyCheck()        		— Adhoc function to display only existing property
		popupLatestData()     		— Adhoc function to build popup HTML for points from WFS feature
		loadDataPoints()       		— Fetches WFS features as GeoJSON data points with circle markers
		updateDataPoints()     		— Zoom-dependent visibility of WFS features
		getCopernicus()        		— Builds an overlay object for Esri dynamic layer
		getCLCserver()         		— Builds a WMS request for CORINE Land Cover rasters
		toggleCorineLayers()   		— Overlay control to hide/show CORINE Land Cover layers
		buttonCorineLayer()    		— Enforces single-layer selection for CORINE Land Cover layers
		toggleCopernicusLayers()	— Overlay control to hide/show available Copernicus layers
		legendUpdate()         		— Refreshes the legend panel HTML per selected overlay
=============================================================== */
async function initMap(inputJSON) {
	
	// Makes the map container visible
	document.getElementById('map').style.display = 'block';
	
	/* 	Base tile layers:
		
		Three publicly available maps are passes to Leaflet's layer control as base maps.
		
		Users can choose any of them depending on their preference.
	*/
	// Creates Open Street Map as background tile layer	
	const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', 
		{
			maxZoom: 20,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}
	);
	
	// Creates topographic Open Street Map as background tile layer
	const osm_topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', 
		{
			maxZoom: 20,
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
		}
	);

	// Creates satellite imagery from ESRI as background tile layer
	const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
		{
			maxZoom: 20,
			attribution: '&copy; Esri & contributors'	
		}
	);
	
	// Initialize base layers for the Leaflet layer control
	baseLayers = {
			"ESRI Satellite": esriSat,
			"OpenStreetMap": osm,
			"OSM Topographic": osm_topo
	};

	/*	Create map instance:

		- Default pan-European view settings (defined globally)
		- ESRI Satellite as the default layer
		- Custom pane for the overlays
			- sits below any user interaction elements (polygons, markers, etc.)
			- disabled from capturing any mouse events
		- Overlay elements added sequentially
	*/
	map = L.map('map').setView([originalCenter.lat, originalCenter.lng], originalZoom);
	map.attributionControl.addAttribution('&copy; Tool developed by C. Arslan, 2025'); // Developer attribution next to map credentials
	map.addLayer(esriSat);
	map.createPane('backgroundPane');
	map.getPane('backgroundPane').style.zIndex = 300;
	map.getPane('backgroundPane').style.pointerEvents = 'none';

	/* 	Overlay 1. ESRI labels
		
		Import labels explicitly as a tile layer for the satellite imagery from ESRI.
	*/
	const esriLabels = L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', 
		{
			maxZoom: 20,
			attribution: '&copy; Esri',
			pane: 'backgroundPane'
		}
	);
	
	// Initialize overlay groups for the Leaflet layer control
	mapOverlays = {
		"Esri Services": {'Labels (ESRI)': esriLabels},
		"EMODnet Services" : {},
		"Copernicus Services" : {}
	};

	
	/*	Overlay 2. EMODnet services
		
		Import data layers from EMODnet (European Marine Observation and Data Network) as 
		supporting information and knowledge for participatory processes.
		
		These services are activated through a toggle "Activate EMODnet Layers" in the 
		layer control. Once activated, full layer list is shown in the control. Users can
		activate each layer, which will be rendered in the backgroundPane together with
		a legend on the right side of the map.
	*/
	/** Function to create a layer descriptor for an EMODnet service using WMS request
		
		Users can check EMODnet WMS data visualization services for detailed information
		on the available themes, layers, and layer properties:
		https://emodnet.ec.europa.eu/en/emodnet-web-service-documentation
		
		@param {string} emodnet_wms: WMS endpoint url
		@param {string} emodnet_layer: WMS layer name
		@param {string} emodnet_style: WMS style name (default null)
		@param {string} emodnet_title: Display label in the layer control
		@returns {{title: string, layer: L.tileLayer.wms, legendUrl: string}}
	*/	
	function getEmodNet(emodnet_wms, emodnet_layer, emodnet_style, emodnet_title) {
		return {
			title: emodnet_title,
			layer: L.tileLayer.wms(emodnet_wms, {
				layers: emodnet_layer,
				styles: emodnet_style || '',
				format: 'image/png',
				transparent: true,
				attribution: '&copy; EMODnet ' + emodnet_title,
				maxZoom: 20,
				pane: 'backgroundPane',
				opacity: 0.75
			}),
			legendUrl: `${emodnet_wms}?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=${emodnet_layer}` 
		};
	}
	
	// EMODnet WMS endpoints (developer's preference)
	const bathWMS = 'https://ows.emodnet-bathymetry.eu/wms';
	const geogWMS = 'https://drive.emodnet-geology.eu/geoserver/tno/wms';
	const humaWMS = 'https://ows.emodnet-humanactivities.eu/geoserver/emodnet/ows'; 
	const habsWMS = 'https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms';
	
	// Toogle for showing/hiding available EMODnet overlays - dummy layerGroup as a checkbox
	const emodnetToggle = L.layerGroup();
	
		
	// Combining scale-dependent (acts on zoom level) sub-layers for coastal migration into one group - acts as a single layer 
	const coastalMigration = L.layerGroup(
	[
		getEmodNet(geogWMS, 'coastal_migration_fd_02_450k_650k', 'coastal_migration_fd_02_450k_650k').layer,
		getEmodNet(geogWMS, 'coastal_migration_fd_01_250k_350k', 'coastal_migration_fd_01_250k_350k').layer,
		getEmodNet(geogWMS, 'coastal_migration_fd_0025_80k_150k', 'coastal_migration_fd_0025_80k_150k').layer,
		getEmodNet(geogWMS, 'coastal_migration_fd_000_0_80k', 'coastal_migration_fd_000_0_80k').layer
	]);	
	
	// Initialize the EMODnet layer list - according to display order in the control
	const emodnetLayers = [
		{title: "Activate EMODnet Layers", layer: emodnetToggle, legendUrl: ""},
		getEmodNet(humaWMS, 'natura2000areas',			null,				'NATURA 2000 Sites'),
		getEmodNet(bathWMS, 'emodnet:mean_multicolour', null, 				'Bathymetry - Mean Depth'),
		getEmodNet(bathWMS, 'emodnet:contours', 		null, 				'Bathymetry - Contours'),
		getEmodNet(bathWMS, 'coastlines', 				'coastline_lat',	'Coastline - Lowest Astronomical Tide'),
		getEmodNet(bathWMS, 'coastlines', 				'coastline_msl', 	'Coastline - Mean Sea Level'),
		getEmodNet(bathWMS, 'coastlines', 				'coastline_mhw', 	'Coastline - Mean High Water'),
		{
			title: "Coastal Migration - Field Data",
			layer: coastalMigration,
			legendUrl: `${geogWMS}?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=coastal_migration_fd_0025_80k_150k`
		},
		getEmodNet(humaWMS, 'dischargepoints', 			'dischargepoints', 	'Waste Disposal - Discharge Points'),
		getEmodNet(humaWMS, 'dredging', 				'dredging', 		'Dredging'),
		getEmodNet(humaWMS, 'vesseldensity_allavg', 	'VesselDensity', 	'Vessel Density - All Types'),
		getEmodNet(habsWMS, 'eov_seagrass_group', 		null, 				'Seagrass Cover in Europe (2025)'),
		getEmodNet(habsWMS, 'coastal_wetlands_2025', 	null, 				'Coastal Wetlands in European Waters (2025)')
	];
		
	/**	Function to expand or collapse the EMODnet layer group in the layer control.
		
		If true, all layers are registered under "EMODnet Services" in mapOverlays.
		If false, all layers are removed (except toggle) from mapOverlays.
		
		Called by overlayAdd and overlayRemove events.
		
		@param {boolen} EMODnetState: true = expand, false = collapse
	*/
	function toggleEMODnetLayers (EMODnetState) {
		if (EMODnetState) {
			emodnetLayers.forEach(lay => {
				mapOverlays["EMODnet Services"][lay.title] = lay.layer;
			});		
		} else {
			emodnetLayers.forEach(lay => {
				if (lay.layer && map.hasLayer(lay.layer)) {
					map.removeLayer(lay.layer);
				}
			});
			mapOverlays["EMODnet Services"] = {};
			mapOverlays["EMODnet Services"][emodnetLayers[0].title] = emodnetLayers[0].layer;
		}
		updateLayerControl();
	}
	
	// Initialize EMODnet layers in collapsed state
	toggleEMODnetLayers(false);
	
	/* 	Handling EMODnet WFS data points for Dredging and Waste Disposal (Discharge Points)
		
		Importing data records for each point on the WMS layers:		
		In addition to the WMS layers for Dredging and Waste Disposal, GeoJSON layers are
		available as WFS point features with rich attribute data.
		
		These point features are loaded as circle markers with hover popups to display
		additional data per point.

		These markers are only visible at specific zoom to spatially distinguish points.
		
		WFS point features originally include records for multiple years. In this tool,
		only the most recent record is extracted as design choice.
	*/
		
	// WFS endpoints for dredging and waste disposal data
	const dredWFS = 'https://ows.emodnet-humanactivities.eu/wfs?SERVICE=WFS&VERSION=1.1.0&request=GetFeature&typeName=dredging&OUTPUTFORMAT=json';
	const dispWFS = 'https://ows.emodnet-humanactivities.eu/wfs?SERVICE=WFS&VERSION=1.1.0&request=GetFeature&typeName=dischargepoints&OUTPUTFORMAT=json';
	
	// Overlay layer references - null until first loaded, cleared on zoom out	
	let dredLayer, dispLayer; 
	
	/** Function to filter WFS FeatureCollection for most recent record per point
	
		Checks for different property names from both dredging and waste disposal 
		
		@param {Object} featureCollection: GeoJSON FeatureCollection from EMODnet WFS
		@returns {Object[]} Array of the most recent GeoJSON features from FeatureCollection
	*/
	function getLatestData(featureCollection) {
		const latestEntry = {};
		featureCollection.features.forEach(f => {
			const props = f.properties;
			const name = props?.extraction_area ?? props?.dcpname;
			if (!name) return;
			const year = Number(props?.year_ ?? props?.year);
			if (!year) return;
			const prevYear = Number(
				latestEntry[name]?.properties?.year_ ?? 
				latestEntry[name]?.properties?.year
			);
			if (!latestEntry[name] || year > prevYear) latestEntry[name] = f;
		});
		return Object.values(latestEntry);
	}
		
	/** Function to return formatted HTML div
		
		Formats the popup field for circle markers of WFS point fetaures.
		
		@param {string} label:	Property label
		@param {*} 		value:	Property value
		@param {string}	unit:	(Optional) unit suffix for a given value
		@returns {string} Formatted HTML string or ''
	*/
	function propertyCheck(label, value, unit='') {
		if (!value || value === "") return '';
		return `<div><strong>${label}:</strong> ${value}${unit}</div>`;
	}
	
	/** Function for displaying popup
		
		Builds the HTML popup for a dredging or waste disposal feature.
		
		Each property is passed through propertyCheck() for formatting AND
		also omitting empty fields.
		
		@param {string} nameLayer:		Overlay layer - "Dredging" or "Waste Disposal - Discharge Points"
		@param {Object} attributesData:	GeoJSON feature with most recent record
		@returns {string} Formatted HTML string for properties of a feature
	*/
	function popupLatestData(nameLayer, attributesData) {
		let htmlData = "";
		if (nameLayer === "Dredging") {
			htmlData = `
					<div style="font-size:1.1em;font-weight:600;text-decoration:underline;margin-bottom:4px;">${nameLayer}</div>
					${propertyCheck("Extraction Area", attributesData.extraction_area)}
					${propertyCheck("Year", attributesData.year_)}
					${propertyCheck('Permitted amount', attributesData.permitted_amount_m3, ' m&sup3')}
					${propertyCheck('Permitted amount', attributesData.permitted_amount_t, ' t')}
					${propertyCheck('Extracted amount', attributesData.extracted_amount_m3, ' m&sup3')}
					${propertyCheck('Extracted amount', attributesData.extracted_amount_t, ' t')}
					${propertyCheck("Extraction Type", attributesData.extraction_type)}
					${propertyCheck("Purpose", attributesData.purpose)}
					${propertyCheck("End Use", attributesData.end_use)}
					<a href="${attributesData.link_to_web_sources}" target="_blank">Link to Web Sources</a>
					`;
		} else if (nameLayer === "Waste Disposal - Discharge Points") {
			htmlData =`
					<div style="font-size:1.1em;font-weight:600;text-decoration:underline;margin-bottom:4px;">${nameLayer}</div>
					${propertyCheck("Name", attributesData.dcpname)}
					${propertyCheck("Year", attributesData.year)}
					${propertyCheck("Status", attributesData.dcpstate)}
					${propertyCheck("Water Body Type", attributesData.dcpwbtype)}
					${propertyCheck("Receiving Area", attributesData.dcptyperca)}
					`;
		}
		return htmlData;
	}
	
	/** Function to import WFS endpoint as data overlay layer into the map

		- Fetches a WFS endpoint as GeoJSON FeatureCollection
		- Filters the most recent record per feature
		- Renders each feature as a transparent circle marker
		- Appends corresponding hover popup to each Marker
		- Adds GeoJSON layer to the map
		
		@param {string} dataWFS:	WFS endpoint URL (GeoJSON output format)
		@param {string} dataLayer:	Display name for popup heading
		@param {number} dataRadius:	Circle marker radius in pixels (default 12)
		@returns {Promise<L.GeoJSON>} Rendered GeoJSON layer as overlay
	*/
	function loadDataPoints(dataWFS, dataLayer, dataRadius = 12) {		
		return fetch(dataWFS)
			.then(res => res.json())
			.then(data => {
				const dataLatest = getLatestData(data);
				const geoLayer = L.geoJSON(dataLatest, {
					pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
						radius: dataRadius,
						color: 'transparent',
						fillColor: 'transparent', 
						opacity: 0,
						fillOpacity: 0
					}),
					onEachFeature: (feature, layer) => {
						layer.bindPopup(popupLatestData(dataLayer, feature.properties));
						layer.on('mouseover', function() {this.openPopup();});
						layer.on('mouseout', function() {
							setTimeout(() => {
								if (!this.getPopup()._container.matches(":hover")) {
									this.closePopup();
								}
							}, 200);
						});
					}
					
				}).addTo(map);
				return geoLayer;
			});
	}		
	
	/** Function to control visibility of data points
	
		Controls zoom-dependent visibility of EMODnet WFS point layers.
		
		Points are only loaded and shown in popup screen at zoom > 6.
		
		Called on: zoomend, overlayadd, overlayremove
	*/
	async function updateDataPoints() {
		const dredOverlay = mapOverlays["EMODnet Services"]?.["Dredging"];
		if (map.getZoom() > 6 && dredOverlay && map.hasLayer(dredOverlay)) {
			if (!dredLayer) dredLayer = await loadDataPoints(dredWFS, "Dredging");
		} else {
			if (dredLayer && map.hasLayer(dredLayer)) {
				map.removeLayer(dredLayer);
				dredLayer = null;
			}
		}
		
		const dispOverlay = mapOverlays["EMODnet Services"]?.["Waste Disposal - Discharge Points"];
		if (map.getZoom() > 6 && dispOverlay && map.hasLayer(dispOverlay)) {
			if (!dispLayer) dispLayer = await loadDataPoints(dispWFS, "Waste Disposal - Discharge Points");
		} else {
			if (dispLayer && map.hasLayer(dispLayer)) {
				map.removeLayer(dispLayer);
				dispLayer = null;
			}
		}
	}
	
	// Wire updateDataPoints to zoom and overlay toggle events
	map.on('zoomend', updateDataPoints);
	map.on('overlayadd overlayremove', updateDataPoints);
		
	/*	Overlay 3. Copernicus services
		
		Import data layers from Copernicus (Earth observation component of the European
		Union's Space programme) as	supporting information and knowledge for
		participatory processes.
		
		These services are activated through a toggle "Activate Copernicus Layers" in the 
		layer control. Once activated, full layer list is shown in the control. Users can
		activate each layer, which will be rendered in the backgroundPane together with
		a legend on the right side of the map.
	*/
	/** Function to create a layer descriptor for a Copernicus service 
	
		Uses ESRI's dynamic map layers to import EEA MapServer endpoints from
		ArcGIS REST services.
		
		Users can check Copernicus land monitoring service portfolio for available
		inventories and detailed information on layers and layer properties:
		https://land.copernicus.eu/en/products
		
		@param {string} 		dataWMS: 	ArcGIS Rest MapServer URL
		@param {number[]|null}	dataLayer: 	Layer indices array (ir relevant)
		@param {string} 		dataTitle: 	Display label in the layer control
		@param {string} 		legendUrl:	URL for the legend graphic
		@param {string}			pane:		Leaflet's pane name to be attached (default backgroundPane)
		@param {number}			opacity:	Layer opacity when rendered on map (default 0.75)	
		@returns {{title: string, layer: L.esri.dynamicMapLayer, legendUrl: string}}
	*/	
	function getCopernicus(dataWMS, dataLayer, dataTitle, legendUrl, pane='backgroundPane', opacity=0.75) {
		return {
			title: dataTitle,
			layer: L.esri.dynamicMapLayer( 
				{
					url: dataWMS,
					layers: dataLayer || null,
					opacity,
					pane,
					minZoom:0,
					maxZoom: 20,
					disableClientCaching: true
				}
			),
			legendUrl
		};
	}
	
	// URL to legend graphic for CORINE Land Cover 2018 (common to all reference years)
	const clcLegend = 'https://image.discomap.eea.europa.eu/arcgis/services/Corine/CLC2018_WM/MapServer/WMSServer?request=GetLegendGraphic%26version=1.3.0%26format=image/png%26layer=12';
	
	/** Function to fetch ArcgGIS REST server URL
		
		Build the server URL for a CORINE land cover year
		
		@param {number} year:	Reference year [1990, 2000, 2006, 2012, 2018]
		@returns {string} ArcGIS REST MapServer url
	*/
	function getCLCserver(year) {
		return `https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC${year}_WM/MapServer`;
	}
	
	// Toogle for showing/hiding CORINE Land Cover reference years - dummy layerGroup as a checkbox
	const corineToggle = L.layerGroup();
	
	// CORINE Land Cover - Five reference years exposed as a time series via corineToggle	
	const clcYear = [1990, 2000, 2006, 2012, 2018];
	const corineLayers = [];
	clcYear.forEach(year => {
		corineLayers.push(getCopernicus(getCLCserver(year), [0, 1],`CLC (${year})`,clcLegend));
	});	
		
	/** Function to expand or collapse the CORINE Land Cover time series
		
		@param {boolean} corineState:	true=expand, false=collapse
	*/
	function toggleCorineLayers (corineState) {
		if (corineState) {
			corineLayers.forEach(lay => {
				mapOverlays["Copernicus Services"][lay.title] = lay.layer;
			});
		} else {
			corineLayers.forEach(lay => {
				if (lay.layer && map.hasLayer(lay.layer)) {
					map.removeLayer(lay.layer);
				}
				if (mapOverlays["Copernicus Services"] && Object.hasOwn(mapOverlays["Copernicus Services"], lay.title)) delete mapOverlays["Copernicus Services"][lay.title];
			});				
		}
		updateLayerControl();	
	}
	
	/** Function to control CORINE Land Cover overlay rendering
	
		Ensures only one CORINE land cover year is visible at a time.
		
		When a year is selected, all other layers are removed from map. 
		
		@param {L.Layer} selectedCorine:	Activated Leaflet layer
	*/
	function buttonCorineLayer(selectedCorine) {
		corineLayers
			.filter(lay => lay.layer !== selectedCorine)
			.forEach(lay => {
				if (map.hasLayer(lay.layer)) map.removeLayer(lay.layer);
			});
		if (!map.hasLayer(selectedCorine)) selectedCorine.addTo(map);
	}
	
	// Server and legend URLs for WMS endpoints of NATURA 2000 Areas  
	const na2kServer = 'https://bio.discomap.eea.europa.eu/arcgis/services/ProtectedSites/Natura2000Sites/MapServer/WMSServer';
	const na2kLegend = 'https://bio.discomap.eea.europa.eu/arcgis/services/ProtectedSites/Natura2000Sites/MapServer/WMSServer?request=GetLegendGraphic%26version=1.3.0%26format=image/png%26layer=2';
	
	// Server and legend URLs for WMS endpoints for Water and Wetness Status for 2018
	const wwsServer = 'https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_WaterWetness_2018/ImageServer/WMSServer';
	const wwsLegend = 'https://image.discomap.eea.europa.eu/arcgis/services/GioLandPublic/HRL_WaterWetness_2018/ImageServer/WMSServer?request=GetLegendGraphic%26version=1.3.0%26format=image/png%26layer=HRL_WaterWetness_2018:WAW_MosaicSymbology';
	
	// Toogle for showing/hiding Copernicus services - dummy layerGroup as a checkbox
	const coperToggle = L.layerGroup();
	
	// Initialize the Copernicus layer list - according to display order in the control
	const copernicusLayers = [
		{title: "Activate Copernicus Layers",	layer: coperToggle,		legendUrl: ""},
		{
			title: 'NATURA 2000 Network',
			layer: L.tileLayer.wms(na2kServer, {
					layers: '2',
					format: 'image/png',
					transparent: true,
					version: '1.3.0',
					attribution: '&copy; EEA',
					maxZoom: 20,
					opacity: 0.75,
					pane: 'backgroundPane'
				}),
			legendUrl: na2kLegend
		},
		{
			title: "Water and Wetness Status 2018",
			layer: L.tileLayer.wms(wwsServer, {
					layers: "HRL_WaterWetness_2018:WAW_MosaicSymbology",
					styles: "default",
					format: "image/png",
					transparent: true,
					version: "1.3.0",
					attribution: '&copy; EEA',
					maxZoom: 20,
					opacity: 0.75,
					pane: 'backgroundPane'
				}),
			legendUrl: wwsLegend
		},
		{title: "Activate CORINE Time Series",	layer: corineToggle,	legendUrl: ""}
	];	
	
	/**	Function to expand or collapse the Copernicus layer group in the layer control.
		
		If true, all layers are registered under "Copernicus Services" in mapOverlays.
		If false, all layers are removed (except toggle) from mapOverlays.
		Collapsing all collapses CORINE Land Cover layer group.		
		
		Called by overlayAdd and overlayRemove events.
		
		@param {boolen} coperState: true = expand, false = collapse
	*/
	function toggleCopernicusLayers (coperState) {
		if (coperState) {
			copernicusLayers.forEach(lay => {
				mapOverlays["Copernicus Services"][lay.title] = lay.layer;
			});
		} else {
			toggleCorineLayers(coperState);
			copernicusLayers.forEach(lay => {
				if (lay.layer && map.hasLayer(lay.layer)) map.removeLayer(lay.layer);
			});
			mapOverlays["Copernicus Services"] = {};
			mapOverlays["Copernicus Services"][copernicusLayers[0].title] = copernicusLayers[0].layer;
		}
		updateLayerControl();
	}
	
	// Initialize Copernicus layers in collapsed state
	toggleCopernicusLayers(false);
	
	/*	LEGEND CONTROL AND OVERLAY EVENT handlers
	
		A custom Leaflet control renders legend graphics for active overlay layers.
		Activated automatically when any layer with a legendUrl is toggled in the
		leaflet control for overlays.
		
		overlayAdd and overlayRemove events handles:
			- expanding and collapsing layers depending on the state
			- updating legend panel with active layers
	*/
	// Custom Leaflet control for legends positioned top-right of the map container
	const legendControl = L.control({position: 'topright'});
	legendControl.onAdd = function () {
		this._div = L.DomUtil.create('div','map-legend');
		this._div.innerHTML = '<em>No active legend</em>';
		this._div.style.display = 'none';
		return this._div;
	};
	legendControl.addTo(map);
	
	// Legend object - keys are layer titles, values are HTML blocks
	legendsOn = {};
	
	/** Function to  update legend panel
		
		Rebuilds the legend panel from the current legendsOn object
	*/
	function legendUpdate() {
		if (Object.keys(legendsOn).length === 0) {
			legendControl._div.innerHTML = '<em>No active legend</em>';
			legendControl._div.style.display = 'none';
			return;
		}
		
		legendControl._div.style.display = 'block';
		legendControl._div.innerHTML = Object.values(legendsOn).join('<hr>');
	}
	
	// On selecting new overlay: expand toggle groups or add legend entries
	map.on('overlayadd', function (e) {
		
		// Toggle group control: 
		// Timeout defers execution until after Leaflet finishes own overlayadd handling 
		if (e.layer === emodnetToggle) {
			setTimeout( () => toggleEMODnetLayers(true), 0); return;
		} 
		if (e.layer === coperToggle) {
			setTimeout( () => toggleCopernicusLayers(true), 0);	return;
		} 
		if (e.layer === corineToggle) {
			setTimeout( () => toggleCorineLayers(true), 0); return;
		} 
		if (corineLayers.some(lay => lay.layer ===e.layer)) {
			setTimeout( () => buttonCorineLayer(e.layer), 0);
		}
		
		// Legend sync - check if an overlay with a legend url is added
		const lay = [...emodnetLayers, ...copernicusLayers, ...corineLayers]
			.find(l => l.layer === e.layer);
		if (!lay?.legendUrl) return;			
		// Update legend panel with format defined in CSS style
		legendsOn[lay.title] = `
								<div class="legend-block">
									<div class="legend-title">${lay.title}</div>
									<div class="legend-image"><img src="${lay.legendUrl}" alt="Legend for ${lay.title}"></div>
								</div>
								`;
		legendUpdate();
	});
	
	// On unselecting existing overlay: collapse toggle groups or remove legend entries
	map.on('overlayremove', function (e) {
		
		// Toggle group control: 
		// Timeout defers execution until after Leaflet finishes own overlayremove handling		
		if (e.layer === emodnetToggle) {
			setTimeout( () => toggleEMODnetLayers(false), 0); return;
		} 
		if (e.layer === coperToggle) {
			setTimeout( () => toggleCopernicusLayers(false), 0); return;
		} 
		if (e.layer === corineToggle) {
			setTimeout( () => toggleCorineLayers(false), 0); return;
		}
		
		// Legend sync - check if an overlay with a legend url is removed
		const lay = [...emodnetLayers, ...copernicusLayers, ...corineLayers]
			.find(l => l.layer === e.layer);
		if (!lay) return;
		delete legendsOn[lay.title]; 
		legendUpdate();
	});
	
	/* 	Informative makeover for users: Scale bar & draw tool labels
		
		A metric scale bar is added to the bottom-left for spatial
		reference during participatory sessions.
 
		Leaflet.draw's default tooltip text is replaced with NB³
		specific labels to guide users during polygon drawing.
	*/
	// Adding scale bar
	L.control.scale({
		position: 'bottomleft',
		metric: true,
		imperial: false
	}).addTo(map);
	
	// Adding framework specific labels to Leaflet's draw tool
	L.drawLocal.draw.toolbar.buttons.polygon = 'Draw a new NB³ Unit';
	L.drawLocal.draw.handlers.polygon.tooltip = {
	  start: 'Click to start drawing the NB³ Unit',
	  cont: 'Click to continue drawing',
	  end: 'Click first point to demarcate the NB³ Unit'
	};
	L.drawLocal.edit.toolbar.buttons.edit = 'Edit the NB³ Unit';
	L.drawLocal.edit.toolbar.buttons.remove = 'Delete the NB³ Unit';
	
	// Register draw event listeners (Section 3)
	addDrawEventListeners();
	
	/* 	Loading parsed JSON data
	
		If inputJSON is provided, the NB³ Units defined per pilot site
		is extracted and rendered in the map sequentially. Accordingly:
		
			1. If a spatial upscaling extent for the current pilot is
			defined, then it is rendered as a semi-transparent Leaflet
			polygon in the map.

			2. For the current pilot, each NB³ Unit is rendered as a
			Leaflet polygon with metadata assigned via polygon.options
			according to the properties in the input JSON. 
			Each NB³ Unit is assigned user interaction events and
			stored in global 'polygons' array.

			3. A Leaflet marker is created for each pilot site and added 
			to the map upon assigning user interaction events.

			4. If NB³ Unit is directly opened through a link in the URL mode,
			then the map is initialized with inputJSON with only that unit
			in its corresponding pilot site, and the map flies directly to
			pilot's zoom in settings from a pan-European view.

			5. If inputJSON is null, the blank map mode is initialized.
	*/
	if (inputJSON && inputJSON.length > 0) {
		// Storing parsed input as global 'locations'
		locations = inputJSON;
		// Looping through each pilot site
		locations.forEach(function(place) {
			
			//	1. Spatial upscaling extent of a pilot site
			if (place.coords && place.coords.length !== 0) {
				
				// Normalizing the coordinates to a multi-ring array: standard rendering as Leaflet polygon
				let placeCoords;
				if (place.coords[0].lat !== undefined) {
					// Wrapping flat coordinates array into ring
					placeCoords = [[ ...place.coords ]];
				} else if (Array.isArray(place.coords[0]) && place.coords[0][0].lat !== undefined) {
					// If already a ring, then keep
					placeCoords = [ ...place.coords ];
				} else {
					// If multi-polygon, flatten one level to polygon 
					placeCoords = place.coords.flat();
				}
				
				// Calculating total area 
				let placeArea = 0;
				placeCoords.forEach(coords => {
					const tempcoord = coords.map(ll => [ll.lng, ll.lat]); // GeoJSON format: [lng, lat]
					const poly = turf.polygon([tempcoord]);	
					placeArea += turf.area(poly); 	
				});	
				const areaPlace = Math.round(placeArea / 10000);
				
				// Rendering a Leaflet polygon per ring and storing in global 'locationsCoords'
				placeCoords.forEach(coords => {
					const placePoly = L.polygon(coords, {
						pilot: place.name,
						code: place.code,
						zIndex: -areaPlace,
						view: true
					});
					placePoly.setStyle({
						color: '#f53bff',
						opacity: 0.25,
						weight: 2,
						fillColor: '#f53bff',
						fillOpacity: 0.15
					});
					assignLocationEvents(placePoly);
					locationsCoords.push(placePoly);
				});
			}
			
			// 2. Rendering NB³ Units of a pilot site as Leaflet polygons
			place.NB3Units.forEach(function(polygonData) {
				
				// Avoid re-loading of existing polygons or undefined coordinates
				if (polygonData.shp) return;
				if (!polygonData.coords || polygonData.coords.length === 0) return;
				
				// Normalizing the coordinates to a multi-ring array: standard rendering as Leaflet polygon 
				const polyOrMultipoly = polygonData.coords[0].lat !== undefined
					? [polygonData.coords]
					: polygonData.coords;
					
				let totArea = 0;
				let tempPolygons = [];
				polyOrMultipoly.forEach(element => {
					
					// Rejecting degenerate rings
					if (!element || !Array.isArray(element) || element.length < 3) return;
					
					// Validating and closing the ring
					const first = element[0];
					const last = element[element.length - 1];
					if (first.lat !== last.lat || first.lng !== last.lng) element.push(first);
					
					// Cheking if a ring is a proper polygon for rendering
					const uniqueVertices = new Set(element.slice(0,-1).map(p => `${p.lat}, ${p.lng}`));
					if (uniqueVertices.size < 3) return;
					if (element.length < 4) return;
					
					// Creating a temporary array with valid rings only
					tempPolygons.push(element);
					
					// Accumulating the total area 
					const ring = element.map(ll => [ll.lng, ll.lat]); 
					totArea += turf.area(turf.polygon([ring]));
				});
				const areaHa = Math.round(totArea / 10000);
				
				// Creating Leaflet polygons with corresponding metadata and user interaction events
				tempPolygons.forEach(coords => {
					const polygon = L.polygon(coords, {
						pilot: place.name,
						delin: polygonData.delin,
						nbsBB: polygonData.nbsBB,
						nbsFW: polygonData.nbsFW,
						zIndex: -areaHa
					});							
					assignPolygonEvents(polygon);
					// Adding polygon to global 'polygons' array
					polygons.push(polygon);
				});	
			});
			
			// Sorting polygons in current pilot by area for correct render order
			reorderPolygons(place.name);
			
			// Adding pilot name to global list (before "New Location")
			glob_pilots.splice(glob_pilots.length - 1, 0, place.name);
			
			// Re-coloring overlapping NB³ Units in current pilot (for user friendly overview)
			if (typeof checkIntersection === 'function') checkIntersection(place.name);
			
			// Attaching pilot site information for the current pilot
			if (!place.description)	place.description = getDescription(place.name);
			
			// 3. Leaflet marker for current pilot
			// Defining a marker for the pilot site at pre-defined geographic location
			const marker = L.marker(
				[place.location.lat, place.location.lng],
				{
					title: place.name
				}
			);
			// Assigning a zoom level from pre-defined view settings
			marker.zoomLevel = place.zoom; 
			// Storing in global 'pilotMarkers' array and assigning user interaction events
			pilotMarkers.push(marker);				
			assignMarkerEvents(marker);
			// Rendering marker on the map
			marker.addTo(map);

			// 4. Rendering NB³ Unit through a link using URL
			// Flying directly to the pre-defined pilot view settings when zoomed into the pilot site
			if (urlExists) {
				addDrawTools();
				locationsCoords.length && locationsCoords.forEach(p => !map.hasLayer(p) && p.options.view && p.addTo(map));
				polygons.forEach(p => !map.hasLayer(p) && p.addTo(map));
				map.flyTo(
					[place.location.lat, place.location.lng], 
					place.zoom, 
					{
						animate: true,
						duration: 1.5,
						easeLinearity: 0.25
					}
				);
			}
		});
	} else {
		// 5. Blank map mode - Initialize with empty data (for globals defined as null)
		activePilot = "";
		locations = [];
	}
	
	/*	Finalizing the map initialization:
		
		└─ Activating user interaction:
			├─ Button for loading shape file 		
			├─ Button for pan-European scale overview 		
			└─ Button for saving current NB³ Units to local drive
		└─ Defining map level event listeners:
			├─ Close right-click menu on any map click 		
			└─ Define actions by zoom level (calibrated empirically): 
				└─ Zoom level >= 10: Suitable resolution for drawing
					├─ Show draw toolbar 		
					├─ Show spatial upscaling extent
					└─ Show NB³ Units 
				└─ Zoom level < 10: Not enough resolution for drawing 
					├─ Hide draw toolbar 		
					├─ Hide spatial upscaling extent
					├─ Hide biotope overlays 
					└─ Hide NB³ Units
				└─ Zoom level >= 6: Pilot-scale zoom in
					└─ Hide pilot markers 
				└─ Zoom level < 6: Pan-European scale
					└─ Show pilot markers 
	*/
	// Activating user interaction
	shapefileBtn.style.pointerEvents = 'auto';
	shapefileBtn.style.opacity = '1';
	resetViewBtn.style.pointerEvents = 'auto';
	resetViewBtn.style.opacity = '1';
	saveLocsBtn.style.pointerEvents = 'auto';
	saveLocsBtn.style.opacity = '1';
	
	// Defining map level event listeners
	map.on('click', function() {
		rightClickMenu = false;
	});
	map.on('zoomend', function () {
		const zoom = map.getZoom();
		if ( zoom >= 10) {
			addDrawTools();
			locationsCoords.length && locationsCoords.forEach(p => !map.hasLayer(p) && p.options.view && p.addTo(map));
			polygons.forEach(p => !map.hasLayer(p) && p.addTo(map));
		} else  {
			removeDrawTools();
			locationsCoords.length && locationsCoords.forEach(p => map.hasLayer(p) && map.removeLayer(p));
			polygons.forEach(p => map.hasLayer(p) && map.removeLayer(p));
			resetBiotopes();
		}
		map.getZoom() >= 6
			? pilotMarkers.forEach(m => map.hasLayer(m) && map.removeLayer(m))
			: pilotMarkers.forEach(m => !map.hasLayer(m) && m.addTo(map));
	});	
}

/* ============================================================
   SECTION 5 — FUNCTIONS FOR HANDLING MAP ELEMENT EVENTS
   ============================================================
	For each pilot site and spatial units within these sites (NB³ Unit or spatial upscaling extent)
	are designed to facilitate user interaction for both data retrieving and data inputting.
	
	These interactions are controlled through functions that assign event handlers for:
		└─ Hover 				→	Mouse moving in/out of an element
			├─ Pilot marker		→	Show/hide info box with pilot properties (name, quick facts, links)
			├─ NB³ Unit			→ 	Show/hide info box with metadata for NB³ Unit		
			└─ Spatial extent	→ 	Show/hide info box with properties (name, code, area)
		└─ Left-click			→	Mouse left-click event 
			├─ Pilot marker		→	Fly to the pilot's pre-defined zoom settings
			└─ NB³ Unit			→ 	Open link to Framework Application Data in new tab	
		└─ Right-click			→	Mouse right-click event 
			└─ NB³ Unit			→ 	Open context menu with a list of available actions NB³ Unit	
*/
/** Function to assign mouse events to pilot markers

	Assigns hover and click event to a pilot site marker.
	
	Events:
		mouseover:	shows popup with pilot description from global 'locations' object
		mouseout:	closes popup with a delay - allows user to hover over popup without closing
		left-click:	flies to pilot's pre-defined zoom settings, sets global 'activePilot', renders all
					NB³ Units and spatial upscaling extent within pilot, activates draw toolbar
					
	@param {L.Marker}	marker:		Leaflet marker created during map initialization in Section 4
*/
function assignMarkerEvents (marker) {
	
	// Mouseover: popup with pilot properties
	marker.on('mouseover', function () {
		const pilot = locations.find(loc => loc.name === marker.options.title);
		const description = pilot ? pilot.description : '';
		const content = '<div><strong>' + marker.options.title + '</strong><br>' + description + '</div>';
		marker.bindPopup(content).openPopup();
	});
	
	// Mouseout: close popup after short delay
	marker.on('mouseout', function () {
		setTimeout(() => {
			if (!marker.getPopup()._container.matches(":hover")) {
				marker.closePopup();
			}
		}, 200);
	});
	
	// Left-click: Zoom into pilot site
	marker.on('click', function () {
		
		// Flying to pre-defined zoom settings
		map.flyTo(
			[marker.getLatLng().lat, marker.getLatLng().lng], 
			marker.zoomLevel, 
			{
				animate: true,
				duration: 1.5,
				easeLinearity: 0.25
			}
		);
		
		// Reset marker view
		map.closePopup();
		map.removeLayer(marker); 
		
		// Setting global flags and enabling user interaction
		activePilot = marker.options.title;
		removeDrawTools();
		addDrawTools();
		
		// Render spatial upscaling extent (if exists)
		locationsCoords.length && locationsCoords.forEach(function (poly) {
			if (poly.options.pilot === activePilot && poly.options.view) {
				poly.addTo(map);
			}
		});
		
		// Render NB³ Units within this pilot
		polygons.forEach(function (poly) {
			if (poly.options.pilot === activePilot) {
				poly.addTo(map);
			}
		});
	});
}

/** Function to assign mouse events to NB³ Units

	Assigns hover and click events to each NB³ Unit created as Leaflet polygon.
	
	Events:
		mouseover:		shows popup with NB³ Unit metadata (code, NbS process, area)
		mouseout:		closes popup 
		left-click:		opens link to Framework Application Data from shared Google Drive in a new table
		right-click:	opens context menu with a list of all available actions for users (Section 6)
		
	@param {L.polygon}	polygon:	NB³ Unit created as a Leaflet polygon layer
*/
function assignPolygonEvents (polygon) {
	
	// Mouseover: popup with NB³ Unit metadata
	polygon.on('mouseover', function () {
		if (isEditPolygon || rightClickMenu) return;
		const content = "<div style='line-height:1.6; font-family: \"Times New Roman\", serif;'>" +
			"<p><strong>NB³ Unit: </strong>" + (this.options.delin || '') + "<br>" +
			"<strong>Restoration Process: </strong>" + (this.options.nbsBB || '') + "<br>" +
			"<strong>Restored Area: </strong>" + (-this.options.zIndex) + "ha</p>" + "</div>";
		this.infoPopup = L.popup({closeButton: false , className: 'infoBox' })
		 .setLatLng(polyLocater(this))
		 .setContent(content)
		 .openOn(map);
	});

	// Mouseout: close popup
	polygon.on('mouseout', function () {
		if (rightClickMenu) return;
		if (this.infoPopup && map.hasLayer(this.infoPopup)) {
			map.closePopup(this.infoPopup);
			this.infoPopup = null;
		}
	});
	
	// Left-click: link to Framework Application Data in a new tab
	polygon.on('click', function () {
	  if (isEditPolygon || rightClickMenu) return;
	  
	  if (isLink(this.options.nbsFW)) {
		window.open(this.options.nbsFW, "_blank");
	  } else {
		alert('Framework Application Data does not exist for ' + this.options.delin + '.\n' + 'Use right-click → Edit NB³ Unit to add a link.');
	  }
	});
	
	// Right-click: context menu
	polygon.on('contextmenu', async function (e) {
		if (isEditPolygon || rightClickMenu) return;
		
		// Suppressing browser’s native context menu
		L.DomEvent.preventDefault(e); 
		
		// Closing any open right-click menu									
		if (this.infoPopup && map.hasLayer(this.infoPopup)) {
			map.closePopup(this.infoPopup);
			this.infoPopup = null;
		}
		
		// Context menu items structured as HTML element
		let menu = '<div style="line-height:1.3; font-family: \"Times New Roman\", serif; font-style: italic; font-size: 14px;">' +
				// Header: NB³ Unit code
				'<div style="padding: 3px 3px; font-weight: bold; border-bottom: 1px solid #666;">' +
					this.options.delin + '</div>' +
				// Edit NB³ Unit wired to editPolygon() in Section 6
				'<div style="padding: 3px 3px; cursor: pointer; border-bottom: 1px solid #ccc;"' +
					'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
					'onmouseout="this.style.backgroundColor=\'white\'" '+
					'onclick="editPolygon()">Edit NB³ Unit</div>' +
				// Modify NB³ Unit wired to editPoints() in Section 6
				'<div style="padding: 3px 3px; cursor: pointer; border-bottom: 1px solid #ccc;"' + 
					'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
					'onmouseout="this.style.backgroundColor=\'white\'" '+
					'onclick="editPoints()">Modify NB³ Unit</div>' +
				// Delete NB³ Unit wired to deletePolygon() in Section 6
				'<div style="padding: 3px 3px; cursor: pointer;" ' + 
					'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
					'onmouseout="this.style.backgroundColor=\'white\'" '+
					'onclick="deletePolygon()">Delete NB³ Unit</div>' + 
				// Link to NB³ Unit wired to linkToPolygon() in Section 6
				'<div style="padding: 3px 3px; cursor: pointer;" ' + 
					'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
					'onmouseout="this.style.backgroundColor=\'white\'" '+
					'onclick="linkToPolygon()">Link to NB³ Unit</div>' + 
				'</div>';
		
		// Context menu items that are displayed upon existence
		// 	├─	Toggle Upscaled Zone wired to toggleView() in Section 6
		//	└─	Baseline Ecological Assessment wired to loadBiotopes() in Section 6
		const hasUpscaled = locationsCoords && locationsCoords.some(loc => loc.options.pilot === this.options.pilot);
		if (hasUpscaled) {
			menu += '<div style="padding: 3px 3px; cursor: pointer;" ' + 
					'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
					'onmouseout="this.style.backgroundColor=\'white\'" '+
					'onclick="toggleView()">Toggle Upscaled Zone</div>';
		}
		const biotopesLoaded = Object.keys(mapOverlays?.Biotopes || {})
			.some(key => key.startsWith(`${this.options.delin}: `));
		if (!biotopesLoaded) {
			const basePath = `data/${this.options.delin}/`;
			let addBiotopeMenuItem = false;
			try {
				const response = await fetch(basePath + 'biotopes.json');
				if (!response.ok){
					console.log(`Biotope check skipped for ${this.options.delin} @${this.options.pilot}: file not found`);
				} else {
					const biotopeCheck = await response.json();
					if (Array.isArray(biotopeCheck.layers) && biotopeCheck.layers.length > 0){
						addBiotopeMenuItem = true;
					} else {
						console.log(`No biotope layers defined for ${this.options.delin} @${this.options.pilot}`);
					}
				}
			} catch (e) {
				console.log("Unexpected network error accessing biotopes directory: ",e);
			}			
			if (addBiotopeMenuItem) {
				menu += '<div style="padding: 3px 3px; cursor: pointer;" ' + 
						'onmouseover="this.style.backgroundColor=\'#f0f0f0\'" '+
						'onmouseout="this.style.backgroundColor=\'white\'" '+
						'onclick="loadBiotopes().catch(console.error)">Baseline Ecological Assessment</div>';  
			}
		}
		
		// Showing the context menu as a Leaflet popup at NB³ Unit centroid
		this.menuPopup = L.popup({ closeButton: false , className: 'menuPopup' })
		 .setLatLng(this.getBounds().getCenter())
		 .setContent(menu)
		 .openOn(map);
		
		// Setting global flags for functions in Section 6
		selectedPolygon = this;
		rightClickMenu = true;
	});
}

/**	Function to assign mouse events to spatial upscaling extent

	Assigns hover events to Leaflet polygon for Restoration Upscaling Zone.
	
	Events:
		mouseover:	shows popup with information including pilot name, zone code, and area
		mouseout:	closes popup 
	
	@param {L.polygon} polygon:	Spatial upscaling extent created as Leaflet polygon
*/		
function assignLocationEvents (polygon) {
	
	// Mouseover: info popup with information on upscaling zone
	polygon.on('mouseover', function () {
		if (isEditPolygon || rightClickMenu) return;
		const content = "<div style='line-height:1.6; font-family: \"Times New Roman\", serif;'>" +
			"<p><span style='font-size:1.2em; text-decoration:underline; font-weight:bold;'>Restoration Upscaling Zone</span>" + "<br>" +
			"<strong>Location:</strong>" + (this.options.pilot || '') + "<br>" +
			"<strong>Code:</strong>" + (this.options.code || '') + "<br>" +
			"<strong>Area:</strong>" + (-this.options.zIndex) + "ha</p>" + "</div>";
		this.infoPopup = L.popup({closeButton: false , className: 'infoBox' })
		 .setLatLng(polyLocater(this))
		 .setContent(content)
		 .openOn(map);
	});

	// Mouseout: close popup
	polygon.on('mouseout', function () {
		if (rightClickMenu) return;
		if (this.infoPopup && map.hasLayer(this.infoPopup)) {
			map.closePopup(this.infoPopup);
			this.infoPopup = null;
		}
	});
}

/* ============================================================
   SECTION 6 — POLYGON INTERACTIONS
   ============================================================
	Each polygon inserted as an NB³ Unit to the map employs user interaction
	via right-click menu. In this section, all functions that handle this
	user interaction are created.

	Right-click menu options include:
		└─ Edit NB³ Unit		→	Users can modify metadata
			└─ editPolygon()	→	Coordinates global flags
								→ 	Deactivates user interaction buttons
								→ 	Handles modal form for metadata modification 		
			└─ showModal2()		→ 	Creates custom modal elements with current metadata
								→ 	Handles callback if users modify any Field
		└─ Modify NB³ Unit		→	Users can relocate/add polygon vertices via Leaflet-Geoman
			└─ editPoints()		→	Coordinates global flags
								→ 	Deactivates user interaction buttons
								→	Done Modifying NB³ Unit button is revealed
			└─ doneEditing()	→ 	Wired to Done Modifying NB³ Unit button
								→	Updates new coordinates and area
								→	Activates user interaction buttons
		└─ Delete NB³ Unit		→	Permanently removes a unit and its data
			└─ deletePolygon()	→	Removes NB³ Unit from map
								→	Removes NB³ Unit from global 'polygons' array
								→ 	Removes NB³ Unit from global 'locations' object
		└─ Link to NB³ Unit		→	Generates a specific link to the unit
			└─ linkToPolygon()	→	Creates a URL link using URI encoding
								→	Copies link to clipboard
		└─ Toggle Upscaled Zone	→	Shows/Hides spatial upscaling extent for pilot
			└─ toggleView()		→	Handles the visibility of the upscaling extent on map
								→	Re-adds all NB³ Units within the pilot for rendering order
		└─ Baseline Ecological Assessment	→	Imports habitat overlays for the NB³ Unit (if exists)
			└─ loadBiotopes()	→	Checks directory (data/[NB³ Unit]) if biotope layers exists
								→	Imports existing layers as overlays in Leaflet control
	
	Right-click action sets the global reference 'selectedPolygon' as the current NB³ Unit.
*/
/** Function to modify NB³ Unit metadata

	Works on the selected unit by activating the modal screen above the map container.
	
	Pre-fills the modal user entry sections with current metadata of the unit.
	
	Uses an inner showModal2() function to handle:
		├─ design of the modal container with corresponding elements 
		├─ using current metadata as placeholders (in case not modified)
		├─ user input from modal callback upon clicking Submit button
		└─ updating both global 'polygons' array and 'locations' object 
*/	
function editPolygon() {
	if (!selectedPolygon) return;
	
	// Disabling user interaction while editing NB³ Unit
	toggleButtons(false);
	removeDrawTools();
	
	// Closing right-click menu
	if (selectedPolygon.menuPopup && map.hasLayer(selectedPolygon.menuPopup)) {
		selectedPolygon.menuPopup.remove();
		selectedPolygon.menuPopup = null;
		rightClickMenu = false;
	}
	
	// Capturing current metadata for pre-filling modal sections
	const pilt = selectedPolygon.options.pilot;
	const deli = selectedPolygon.options.delin;
	const bb = selectedPolygon.options.nbsBB;
	const fw = selectedPolygon.options.nbsFW;
	
	// Setting global flag for NB³ Unit as editing and hightlighting edited unit with dashed border 
	isEditPolygon = true;
	selectedPolygon.setStyle({ dashArray: "5,5" });
	
	// Opening the modal screen with pre-filled metadata as placeholder
	showModal2(deli, bb, fw, function(delineation, building_block, framework) {
		
		// Updating NB³ Unit's own properties both: 
		// 	├─ directly for legacy event handlers
		//	└─ using options for standard Leaflet pattern
		selectedPolygon.delin = delineation;
		selectedPolygon.nbsBB = building_block; 
		selectedPolygon.nbsFW = framework;
		selectedPolygon.options.delin = delineation;
		selectedPolygon.options.nbsBB = building_block;
		selectedPolygon.options.nbsFW = framework;
		
		// Updating global 'locations' object for matching NB³ Unit
		const matchingLocation = locations.find(loc => loc.name === pilt);
		if (matchingLocation) {
			const matchingCoastalUnit = matchingLocation.NB3Units.find(unit => unit.delin === deli && unit.nbsBB === bb);
			if (matchingCoastalUnit) {
				matchingCoastalUnit.delin = delineation;
				matchingCoastalUnit.nbsBB = building_block;
				matchingCoastalUnit.nbsFW = framework;
			}
		}
		
		// Enabling user interaction and restoring style upon completion
		isEditPolygon = false;
		selectedPolygon.setStyle({ dashArray: null });
		toggleButtons(true);
		addDrawTools();
	});
				
	/** Function to create modal form for user input
	
		Builds the modal with corresponding fields for NB³ Unit's current metadata and
		pre-fills the user input fields. 
		
		Current values shown as placeholders for user input fields, allowing users to
		keep any existing metadata and instead modify only what needs changing.
		
		Upon submission, any changed metadata will be captured, unchanged fields will
		return the original placeholder value.
		
		@param {string}		deliPlaceHolder:	Current NB³ Unit's code
		@param {string}		bbPlaceHolder:		Current NB³ Unit's NbS process
		@param {string}		fwPlaceHolder:		Current NB³ Unit's link to framework application data
		@param {function}	callback:			Called with updated field or placeholder value
	*/		
	function showModal2(deliPlaceHolder, bbPlaceHolder, fwPlaceHolder, callback) {
		// Setting modal container
		const modalContainer = document.createElement("div");
		modalContainer.className = "modal";
		const modalContent = document.createElement("div");
		modalContent.className = "modal-content";
		
		// Creating header field for the current NB³ Unit and pilot name
		const heading = document.createElement("h3");
		heading.textContent = `Edit Properties of ${deliPlaceHolder} @${pilt}`;
		modalContent.appendChild(heading);
		
		// Creating pre-filled metadata fields
		let fields = [
			{ 
				label: "The NB³ Unit's Code:", 
				placeholder: deliPlaceHolder, 
				id: "textField1" 
			},
			{ 
				label: "NbS-driven Restoration Process:", 
				placeholder: bbPlaceHolder, 
				id: "textField2" 
			},
			{ 
				label: "Link to the Framework Application Data:", 
				placeholder: fwPlaceHolder, 
				id: "textField3" }
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
		
		// Same pattern as showModal() (Section 3): 
		// 	├─ button with link to pilot's shared Google Drive folder
		//	└─ info field with explanation for users on how to use the folder
    	const buttonWrapper = document.createElement("div");
    	buttonWrapper.style.display = "flex";
    	buttonWrapper.style.marginLeft = "12px";
    	buttonWrapper.style.alignItems = "center";
		buttonWrapper.style.marginTop = "10px"; 
		const infoButton = document.createElement("button");
		infoButton.textContent = "Link to Shared Folder";
		infoButton.title = "Go to the shared folder of the selected location";
		infoButton.addEventListener("click", () => {
			const folderUrl = linksToSharedFolders[pilt] || linksToSharedFolders["New Location"];
			window.open(folderUrl, "_blank");
		});
		const tipText = document.createElement("span");
		tipText.innerHTML = 'Go to the shared folder to select the framework application data and copy the link below.<br>' +
							'Please use e.g. "The NB3 Instance newUnit1" if a new NB³ Unit is created.';
		tipText.style.color = "#003366";
		tipText.style.fontStyle = "italic";
		tipText.style.fontSize = "14px";
		tipText.style.marginLeft = "5px";
    	buttonWrapper.appendChild(infoButton);
    	buttonWrapper.appendChild(tipText);
    	modalContent.appendChild(buttonWrapper);
		
		// Creating submit button: 
		// 	├─ 	if changed, capture new values for metadata
		//	├─ 	otherwise, use pre-filled values
		//	├─	collapse modal container
		//	└─ 	fire callback with updated metadata 
		const submitButton = document.createElement("button");
		submitButton.textContent = "Submit";
		submitButton.addEventListener("click", function() {
			const delineation = document.getElementById("textField1").value || deliPlaceHolder;
			const building_block = document.getElementById("textField2").value || bbPlaceHolder;
			const framework = document.getElementById("textField3").value || fwPlaceHolder;
			document.body.removeChild(modalContainer);
			callback(delineation, building_block, framework);
		});
		
    	modalContent.appendChild(submitButton);
		
		// Inserting modal container before the map container
		modalContainer.appendChild(modalContent);
		document.body.insertBefore(modalContainer,document.getElementById("map"));
	}
}

/** Function to modify polygon vertices for NB³ Unit

	Activates Leaflet-Geoman vertex editing on the selected NB³ Unit.
	
	Uses Geoman's pm.enable() interface for rendering draggable vertex points.
	
	Enables "Done Modifying NB³ Unit" button, which is hidden by default in CSS.
*/	
function editPoints() {		
	if (!selectedPolygon) return;
				
	// Closing right-click menu
	if (selectedPolygon.menuPopup && map.hasLayer(selectedPolygon.menuPopup)) {
		selectedPolygon.menuPopup.remove();
		selectedPolygon.menuPopup = null;
		rightClickMenu = false;
	}
	
	// Setting global flag for NB³ Unit as editing and disabling user interaction
	isEditPolygon = true;
	toggleButtons(false);
	removeDrawTools();
	
	// Enabling "Done Modifying NB³ Unit" button
	document.getElementById('done-editing-btn').style.display = 'block';
	
	// Activating Geoman vertex edit mode
	selectedPolygon.pm.enable({ allowSelfIntersection:false });
	
	// Hightlighting edited unit with dashed border 
	selectedPolygon.setStyle({ dashArray: "5,5" });
}
/** Function to finalize editing vertices of NB³ Unit
		├─	Disables Leaflet-Geoman editing,
		├─ 	Re-calculates the area,
		├─	Updates corrdinates in global 'locations' object
		├─	Restores user interaction and global flags
		└─	Checks overlapping units within the pilot (for user-friendly visibility)
*/
function doneEditing() {	
	if (!selectedPolygon) return;
	
	// Disabling Geoman vertex editing mode
	selectedPolygon.pm.disable();
	
	// Capturing current metadata for 'locations' object lookup 
	const pilt = selectedPolygon.options.pilot;
	const deli = selectedPolygon.options.delin;
	const bb = selectedPolygon.options.nbsBB;
			
	// Calculating area using Turf.js
	const latlngs = selectedPolygon.getLatLngs()[0];
	const newCoordinates = latlngs.map(ll => [ll.lng, ll.lat]); 
	newCoordinates.push(newCoordinates[0]);
	const areaHa = Math.round(turf.area(turf.polygon([newCoordinates])) / 10000);
	selectedPolygon.options.zIndex = -areaHa;

	// Preparing updated coordinates for storing in global  'locations'
	const updatedCoordinates = latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
	updatedCoordinates.push(updatedCoordinates[0]);
	
	// Updating coordinates of the modified NB³ Unit in 'locations' 
	const matchingLocation = locations.find(loc => loc.name === pilt);
	if (matchingLocation) {
		const matchingCoastalUnit = matchingLocation.NB3Units.find(unit => unit.delin === deli && unit.nbsBB ===bb);
		if (matchingCoastalUnit) {
			matchingCoastalUnit.coords = updatedCoordinates;
		}
	}
				
	// Restoring user interaction and global flags
	isEditPolygon = false;
	selectedPolygon.setStyle({ dashArray: null });
	selectedPolygon = null;	
	toggleButtons(true);
	addDrawTools();
	document.getElementById("done-editing-btn").style.display = 'none';
	
	// Checking overlapping NB³ Units within the pilot for re-coloring
	const checkPolygons = polygons.filter(poly => poly.options.pilot === pilt);
	if (checkPolygons.length > 1) checkIntersection(pilt);
}

// Wiring doneEditing() function to "Done Modifying NB³ Unit" button
document.getElementById("done-editing-btn").onclick = function () {
	doneEditing();
};

/** Function to remove NB³ Unit from map

	Removes the selected NB³ Unit permanently from the map and internal storage.
	
	Note: If NB³ Unit is assembled by multiple Leaflet polygons when imported in 
	MultiPolygon JSON structure, then all polygon layers belonging to NB³ Unit 
	are removed.
*/
function deletePolygon() {
	if (!selectedPolygon) return;
	
	// Closing right-click menu
	if (selectedPolygon.menuPopup && map.hasLayer(selectedPolygon.menuPopup)) {
		map.closePopup(selectedPolygon.menuPopup);
		selectedPolygon.menuPopup = null;
		rightClickMenu = false;
	}
					
	// Removing all Leaflet layers with matching NB³ Unit code
	const delinToRemove = selectedPolygon.options.delin;
	const pilotToCheck = selectedPolygon.options.pilot;
	 polygons
		.filter(p => p.options.delin === delinToRemove)
		.forEach(p => { if (map.hasLayer(p)) map.removeLayer(p); });

	// Updating global 'polygons' array and map view for overlapping NB³ Units within the pilot
	polygons = polygons.filter(p => p.options.delin !== delinToRemove);
	checkIntersection(pilotToCheck);
	
	// Updating global 'locations' object
	locations.forEach(loc => {
		loc.NB3Units = loc.NB3Units.filter(unit => unit.delin !== delinToRemove);
	});
	
	// Restoring global flag
	selectedPolygon = null;						
}

/** Function to generate a unique URL for NB³ Unit

	Constructs URL to load the tool with only the NB³ Unit with queries on its metadata.

	Uses URI encoding to safely handle special characters, spaces, and non-ASCII labels.
		
	Copies URL to the clipboard, requiring a secure context (HTTPS or localhost).
	NOTE: GitHub pages deployment satisfies this requirement.
	
	URL format:
		<origin><pathname>?nb3L=<NB³ Unit's Pilot Site>?nb3U=<NB³ Unit's Code>?nb3uP=<NB³ Unit's NbS-process>
*/
function linkToPolygon() {		
	if (!selectedPolygon) return;
				
	// Closing right-click menu
	if (selectedPolygon.menuPopup && map.hasLayer(selectedPolygon.menuPopup)) {
		map.closePopup(selectedPolygon.menuPopup);
		selectedPolygon.menuPopup = null;
		rightClickMenu = false;
	}
	
	// Generating link from NB³ Unit's metadata
	const pilotID = encodeURIComponent(selectedPolygon.options.pilot);
	const cuID = encodeURIComponent(selectedPolygon.options.delin);
	const nbsID = encodeURIComponent(selectedPolygon.options.nbsBB);
	const urlPoly = `${window.location.origin}${window.location.pathname}?nb3L=${pilotID}&nb3U=${cuID}&nb3P=${nbsID}`;

	// Copying to clipboard with user confirmation
	navigator.clipboard.writeText(urlPoly);
	alert("Link to the NB³ Unit copied to clipboard:\n" + urlPoly);

}

/** Function to toggle spatial upscaling extent of a pilot

	Toggles the visibility of the upscaling extent rendered as Restoration Upscaling Zone
	in the map for the pilot site.
	
	Maintains the render order for all NB³ Units by bringing them to front.
	
	NOTE: In this current version of the Interactive Web Map tool, this spatial extent is
	attached to any NB³ Unit within the pilot. In future version, defining and rendering 
	this upscaling zone might be designed again in collaboration with stakeholders' 
	demands and approaches.
*/	
function toggleView() {		
	if (!selectedPolygon) return;
				
	// Closing right-click menu
	if (selectedPolygon.menuPopup && map.hasLayer(selectedPolygon.menuPopup)) {
		selectedPolygon.menuPopup.remove();
		selectedPolygon.menuPopup = null;
		rightClickMenu = false;
	}
	
	// Extracting pilot's spatial upscaling extent and all NB³ Units within the pilot
	const plt = selectedPolygon.options.pilot;
	const tempPolys = polygons.filter(p => p.options.pilot === plt);
	const tempLocs = locationsCoords
		? locationsCoords.filter(loc => loc.options.pilot === plt)
		: [];
	
	// Toggling the spatial upscaling extent in the map
	let view = false;
	tempLocs.forEach(loc => {
		if (map.hasLayer(loc)) {
			map.removeLayer(loc);
			loc.options.view = false;
		} else {
			loc.addTo(map);
			loc.options.view = true;
			view = true;
		}
	});
	
	// If added, maintain render order by bringing NB³ Units to front
	if (view) {
		tempPolys.forEach(p => {
			if (map.hasLayer(p)) {
				map.removeLayer(p);
				p.addTo(map);
			}
		});
	}
}

/** Function to load habitat overlays for NB³ Unit (if exists)

	Imports biotope layers-produced according to EUNIS claasification by the pilot stakeholders-
	from directory "data/<NB³ Unit>".
	
	Adds each layer as Leaflet overlay in the layer control.
	
	In the directory, a manifest file 'biotopes.json' includes title and GeoJSON layer file name.
	Accordingly, layer file is fetched from the same directory and included under "Biotopes" grouped
	layer in the layer control.
	
	These biotope overlays are rendered transparently in the background with no interaction as the pilot's
	Baseline Ecological Assessment.
*/
async function loadBiotopes() {	
	if (!selectedPolygon) return;
				
	// Closing right-click menu
	if (selectedPolygon.menuPopup && map.hasLayer(selectedPolygon.menuPopup)) {
		selectedPolygon.menuPopup.remove();
		selectedPolygon.menuPopup = null;
		rightClickMenu = false;
	}
	
	
	const delin = selectedPolygon.options.delin
	const basePath = `data/${delin}/`;

	try {
		// Fetching and parsing the manifest file under the directory
		const response = await fetch(basePath + 'biotopes.json');
		if (!response.ok){
			console.log(`Biotope manifest not found for ${delin}`);
			return;
		}	
		const biotopeFile = await response.json();
		if (!biotopeFile.layers || biotopeFile.layers.length === 0){
			console.log(`No biotope layers defined in manifest for ${delin}`);
			return;
		}	
		
		// Fetching and parsing each layer in the manifest file to store in global store
		biotopeLayers = {};
		for (const layer of biotopeFile.layers) {
			try {
				const isBiotopeLayer = await fetch(basePath + layer.file);
				if (!isBiotopeLayer.ok) {
					console.log(`Biotope layer file not found or unreadable: ${layer.file} for ${delin}`);
					continue;
				}
				const geojson = await isBiotopeLayer.json();
				
				// Creating a non-interactive transparent Leaflet GeoJSON layer in the background
				const leafletLayer = L.geoJSON(geojson, {
					pane: 'backgroundPane',
					interactive: false,
					style: {
					  color: layer.color,
					  weight: 1,
					  fillOpacity: 0.4
					}
				});
				biotopeLayers[layer.name] = leafletLayer;
			} catch (e) {
				console.log(`Error loading biotope layer "${layer.name}" for ${delin}:`,e);
			}
		}
		
		// Guarding for failed fetching of all layers by exiting without updating the control
		if (Object.keys(biotopeLayers).length === 0) {
			console.log(`No valid biotope layers could be loaded for ${delin}`);
			return;
		}
		
		// Registering loaded layers as overlays in the layer control
		mapOverlays["Biotopes"] = mapOverlays["Biotopes"] || {};
		for (const [layerName, layerShape] of Object.entries(biotopeLayers)) {
			const label = `${delin}: ${layerName}`;
			mapOverlays["Biotopes"][label]	= layerShape;
		}
		updateLayerControl();
	} catch (e) {
		console.log('Unexpected network error accessing biotope directory: ', e);
	}
}

/* ============================================================
   SECTION 7 — UTILITY & HELPER FUNCTIONS
   ============================================================
	Self-contained helper functions called by script at multiple sections
	of the application.  

	Functions:
		resetBiotopes()				— removes biotope overlays from map
		toggleButtons(enable)       — toggles page buttons  
		getDescription(name)        — assigns pilot info HTML for marker popups
		isLink(testLink)			— validates a string as a proper URL 
		polyLocater(polygon)        — returns top-right corner of a polygon
		checkIntersection(atPilot)  — detects and highlights overlapping NB³ Units
		updateLayerControl()  		— rebuilds the grouped layer control panel
		openReadme()          		— opens README markdown in a styled browser tab
=============================================================== */
/** Function to remove all biotope layers from the Map

	Removes all biotope overlay layers from the map and clears them from the layer control.
	
	Called on resetting map view to pan-European overview and manual zoom out to keep 
	layer control clean when not in pilot view mode.
*/	
function resetBiotopes() {
	if (Object.keys(biotopeLayers).length === 0) return;
	
	// Removing each overlay  from the map
	Object.values(biotopeLayers).forEach(layer => {
		if(map.hasLayer(layer)) map.removeLayer(layer);
	});
	
	// Clearing the global layer store and grouped overlay for biotopes
	biotopeLayers = {};
	delete mapOverlays["Biotopes"];
		

	updateLayerControl();
}

/** Function to control state of page buttons
	
	Toggles all user interaction buttons simultaneously.
	
	Called at the start and at the end of any user interaction
	to prevent conflicting user actions.
	
	When disabled, buttons are disabled both visually (transparent)
	and functionally (pointerEvents none).
	
	@param {boolean} enable:	true when all buttons are active, false vice versa.
*/	
function toggleButtons(enable) {
	const ids = [
		"reset-view-button", 
		"load-locations-btn", 
		"load-locations-btn-WL", 
		"load-locations-btn-file", 
		"load-new-locations-btn", 
		"save-locations-btn", 
		"file-select-btn"
	];
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

/** Function to generate pilot information

	Returns pre-structured HTML string for a pilot site properties to inform users.
	
	Used for showing this information in hover popup for pilot markers.
	
	Information is based on the pilots in the REST-COAST project:
		- Sea basin
		- Quick facts:
			- Scale
			- Countries
			- Coastal elements
			- Download: pdf with detailed pilot information
			- Go to: shared Google Drive folder
		
	Custom pilots added via "New Location" share generic template.
	
	@param {string} name:	Pilot site name - must match gobal 'locations' object
	@returns {string}	HTML string - used in parker popup
*/
function getDescription(name) {
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
					+ '</div>';
	}
}

/** Function to validate a web link
	
	Validates if a string is a valid HTTP, HTTPS, or FTP URL.
	
	@param {string} testLink:	String to test
	@returns {boolean}	true if the string matches URL pattern
*/
function isLink(testLink) {
  const urlRegex = /^(?:https?|ftp):\/\/[\w.-]+\.\w{2,}(?:\/\S*)?$/;
  return urlRegex.test(testLink);
}

/** Function to calculate top-right corner of a polygon
	
	Returns the top-right corner of a Leaflet polygon's bounding box
	as a Leaflet latitude and longitue object. 
	
	Used to achor hover info popups to a fixed location for Leaflet
	polygons (top-right).
	
	Avoids the blocking of a polygon's view on map.
	
	@param {L.polygon} polygon:		NB³ Unit as a Leaflet polygon layer
	@returns {L.latLng} The north-east corner of the polygon's bounding box
*/	
function polyLocater(polygon) {
	const coords = polygon.getLatLngs()[0];
	const maxLat = coords.reduce((max, coord) => Math.max(max, coord.lat), coords[0].lat);
	const maxLng = coords.reduce((max, coord) => Math.max(max, coord.lng), coords[0].lng);
	return L.latLng(maxLat, maxLng);
}

/** Function to detect intersection for colour coding

	Checks whether any NB³ Units within a given pilot site spatially overlap and assign 
	different colors for overlapping NB³ Units for user-friendly visualization.
	
	Routine:
		- Filtering all NB³ Units at a specific pilot
		- Setting the style of all NB³ Units with default properties
		- Generating distinct colors matching the total number of NB³ Units
		- Running a pairwise intersection check using Turj.js' intersection function
		- Applying a distinct color to the intersecting NB³ Unit
	
	@param {string} atPilot:	Pilot site name to check intersection
*/	
function checkIntersection(atPilot) {
	
	// Filtering all NB³ Units at this pilot
	var checkPolygons = polygons.filter(p => p.options && p.options.pilot === atPilot);
	
	// Applying a default style for all NB³ Units 
	checkPolygons.forEach(p => {
		p.setStyle({
			color: '#08d600',
			opacity: 0.8,
			weight: 2,
			fillColor: '#56ff01',
			fillOpacity: 0.35
		});
		// If user interaction is active on NB³ Unit, making more transparent for visual cue
		if (isEditPolygon) {
			p.setStyle({ opacity: 0.4, fillOpacity: 0.1 });
		}
	});
	
	// Checking if there exists more than one NB³ Units
	if (checkPolygons.length <= 1) return;
	
	/** Function to generate distinct colors
		
		Generates evenly spaced HSL colors around the color wheel.
		
		@param {number} n:	Number of colors to generate
		@returns {string[]} Array of CSS HSL coor strings
	*/
	function generateColors(n) {
		return Array.from({ length: n }, (_, i) => {
			const hue = Math.round((360/n)*i);
			return `hsl(${hue}, 70%, 50%)`;
		});
	}
	
	//  Generating color palette with distinct colors matching number of NB³ Units
	const numCU = new Set(checkPolygons.map(p => p.options.delin)).size;
	const colorP = generateColors(numCU);
	let colorInd = 0;
	
	// Checking overlapping NB³ Units by pairwise intersection control			
	for (let i = 0; i < checkPolygons.length; i++) {
		for (let j = i + 1; j < checkPolygons.length; j++) {
			
			// Skipping NB³ Units that compose of MultiPolygons
			if (checkPolygons[i].options.delin === checkPolygons[j].options.delin) continue;
			
			// Converting Leaflet polygons to Turf GeoJSON format
			const coords1 = checkPolygons[i].getLatLngs()[0].map(ll => [ll.lng, ll.lat]);
			const coords2 = checkPolygons[j].getLatLngs()[0].map(ll => [ll.lng, ll.lat]);
			
			// Ensuring rings are closed
			if (coords1[0][0] !== coords1[coords1.length - 1][0] || coords1[0][1] !== coords1[coords1.length - 1][1]) {
				coords1.push(coords1[0]);
			}
			if (coords2[0][0] !== coords2[coords2.length - 1][0] || coords2[0][1] !== coords2[coords2.length - 1][1]) {
				coords2.push(coords2[0]);
			}
			const poly1 = turf.polygon([coords1]);
			const poly2 = turf.polygon([coords2]);
			if (!poly1 || !poly2) {
				console.warn(
					`Invalid polygon geometry at ${atPilot}: `, 
					checkPolygons[i].options.delin, poly1, 
					checkPolygons[j].options.delin, poly2
				);
				continue;
			}
			
			// Applying a distinct color to overlapping NB³ Unit
			try {
			  if (turf.intersect(poly1, poly2)) {
				const color = colorP[colorInd % colorP.length];
				checkPolygons[j].setStyle({ fillColor: color, color: color });
				colorInd++;
			  }
			} catch (err) {
			  console.warn(`Intersection check failed at ${atPilot} for ${checkPolygons[i].options.delin} ∩ ${checkPolygons[j].options.delin}:`, err);
			}
		}
	}			
}

/** Function to re-build the grouped layer control panel

	Leaflet control panel cannot be dynamically updated upon addition or
	removal of overlays after initialization. Thus, any time an overlay is
	added or removed, the whole control panel is built from scratch with
	with current list of baseLayers and mapOverlays.
	
	Called by:
		- toggleEMODnetLayers()
		- toggleCorineLayers()
		- toggleCopernicusLayers()
		- loadBiotopes()
		- resetBiotopes()
*/	
function updateLayerControl() {
	
	// Removing the existing control to avoid conflicting states in the control DOM.
	if (layerControl) {
		map.removeControl(layerControl);
	}
	
	// Creating a new layer control
	layerControl = L.control.groupedLayers(
		baseLayers,
		mapOverlays,
		{ position: 'topleft' }
	).addTo(map);
}
/** Function to open the project README in a new tab with a neat format 

	Fetches the README markdown file from the GitHub server in a raw format.
	
	Uses marked.js Markdown parser and github-markdown.css styling to render
	raw README markdown	as a styled HTML.
	
	Defines the HTML structure of the tab to match the styling in the original 
	project README markdown in the GitHub Server.
*/	
async function openReadme() {
	
	// Reusing existing tab if still open
	if (ReadmeTab && !ReadmeTab.closed) {
		ReadmeTab.focus();
		return;
	}
	
	// Opening a new blank tab
	ReadmeTab = window.open();
	
	// Fetching and rendering the project README markdown using marked.js library
	const response = await fetch("https://raw.githubusercontent.com/c-arslan-wur/interactive-web-map/refs/heads/main/README.md");
	const markedTxt = await response.text();
	const markedHtml = marked.parse(markedTxt);
	
	// Writing into the new tab the styled HTML page using github-markdown.css stylesheet  
	ReadmeTab.document.write(`
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<title>About the Interactive Web Map</title>
			<link rel="stylesheet" href="libs/marked/github-markdown.css" />
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