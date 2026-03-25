const INITIAL_CENTER = [13.388, 52.517]

const INITIAL_ZOOM = 2



const map = new maplibregl.Map({
  style: 'https://tiles.openfreemap.org/styles/bright',
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM,
  container: 'map',
  // Add your custom attribution here
  customAttribution: 'Notable People Data <a href="https://www.kaggle.com/datasets/beridzeg45/notable-people-in-history" target="_blank">beridzeg45 on Kaggle</a>'
})

const STORAGE_KEY = "masteredPeople";

function getMasteredPeople(){
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveMasteredPeople(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function addMasteredPerson(name){
  let mastered = getMasteredPeople();

  // avoid duplicates
  if(!mastered.includes(name)){
    mastered.push(name);
  }

  saveMasteredPeople(mastered);
}


function resetMasteredPeople(){
  localStorage.removeItem(STORAGE_KEY);
}   

let allPeople = []

let gamePeople = []

let currentIndex = 0

let guesses = []

let wikiData = null

let roundActive = true

let resultLine = null

let wikiPhotos = []

let currentCountryCenter = null;
let currentCountryBounds = null;


let guessMarker = null

let answerMarker = null


const wikiCache = {}

const questionDiv = document.getElementById("question")

const resultDiv = document.getElementById("result")

const nextBtn = document.getElementById("nextBtn")

const photo = document.getElementById("photo")


function clearResultMarkers() {
  if (window.resultMarkers) {
    window.resultMarkers.forEach(m => m.remove());
    window.resultMarkers = [];
  }
}


// Load GeoJSON



fetch("https://mapsmania.github.io/inventions/notable_people.geojson")
  .then(res => res.json())
  .then(data => {

    allPeople = data.features;

    // Build country counts
    const countryCount = {};

    allPeople.forEach(p => {
      const country = p.properties["Birth Country"];
      if(country){
        countryCount[country] = (countryCount[country] || 0) + 1;
      }
    });

    // Filter countries with at least 10 people
    const playableCountries = Object.keys(countryCount).filter(c => countryCount[c] >= 10);

    const countryButtonsDiv = document.getElementById("countryButtons");

    playableCountries.forEach(country => {
      const btn = document.createElement("button");
      btn.textContent = country;
      btn.onclick = () => {
        startCountryGame(country);
      };
      countryButtonsDiv.appendChild(btn);
    });

    // Optional: sort alphabetically
    countryButtonsDiv.querySelectorAll("button")
      && Array.from(countryButtonsDiv.querySelectorAll("button"))
        .sort((a,b) => a.textContent.localeCompare(b.textContent))
        .forEach(b => countryButtonsDiv.appendChild(b));

    // Show welcome screen now that buttons exist
    document.getElementById("welcomeOverlay").style.display = "flex";
  });

function startCountryGame(countryName) {

  clearResultMarkers();
    
  document.getElementById("welcomeOverlay").style.display = "none";
  const panel = document.getElementById("panel");

panel.style.display = "flex";


  

  // 1. Filter people for this country
  const countryPeople = allPeople.filter(p => p.properties["Birth Country"] === countryName);

  if (countryPeople.length > 0) {
    const bounds = new maplibregl.LngLatBounds();
    countryPeople.forEach(p => bounds.extend(p.geometry.coordinates));

    // Store the bounds globally so the Next button can find them
    currentCountryBounds = bounds;
    currentCountryCenter = bounds.getCenter();

    map.fitBounds(bounds, {
      padding: 100,
      duration: 2000
    });
  }

  // Shuffle and pick 10
  gamePeople = shuffle(countryPeople).slice(0, 10);
  currentIndex = 0;
  guesses = [];
  wikiPhotos = [];

  askQuestion();
}

function startGame(){

  clearResultMarkers();
    
  document.getElementById("summaryOverlay").style.display = "none";
  const panel = document.getElementById("panel");

panel.style.display = "flex";


  
  currentCountryCenter = null;
  currentCountryBounds = null; // ✅ important fix

  const mastered = getMasteredPeople();

  const availablePeople = allPeople.filter(p => 
    !mastered.includes(p.properties.Name)
  );

  const pool = availablePeople.length >= 10 ? availablePeople : allPeople;

  gamePeople = shuffle(pool).slice(0, 10);
  currentIndex = 0;
  guesses = [];

  askQuestion();
}


async function loadWikipedia(personName){

  // check cache first
  if(wikiCache[personName]){
    const data = wikiCache[personName]
    wikiData = data

    if(data.thumbnail){
      photo.src = data.thumbnail.source
      photo.style.display = "block"
      wikiPhotos[currentIndex] = data.thumbnail.source
    }else{
      photo.style.display = "none"
      wikiPhotos[currentIndex] = null
    }

    return
  }


  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(personName)}`

  try{

    const res = await fetch(url)
    const data = await res.json()

    // store in cache
    wikiCache[personName] = data

    wikiData = data

    if(data.thumbnail){
      photo.src = data.thumbnail.source
      photo.style.display = "block"
      wikiPhotos[currentIndex] = data.thumbnail.source
    }else{
      photo.style.display = "none"
      wikiPhotos[currentIndex] = null
    }

  }catch(e){
    console.log("Wiki error", e)
    wikiData = null
  }
}

// World Game: hide overlay and start regular game
document.getElementById("worldGameBtn").onclick = () => {
  document.getElementById("welcomeOverlay").style.display = "none";
  startGame();
};

// Country Game: hide first choice, show country list panel
document.getElementById("countryGameBtn").onclick = () => {
  document.getElementById("welcomeChoice").style.display = "none";
  document.getElementById("countryListPanel").style.display = "flex";
};

function askQuestion(){

 
document.getElementById("scoreFill").style.width = "0%"

  const person = gamePeople[currentIndex]



  questionDiv.innerHTML =

  `<b>Question ${currentIndex + 1} / 10</b><br>

  <b>${person.properties.Name}</b><br>

  ${person.properties.Occupation}<br>

  Born ${person.properties["Birth Year"]}<br><br>

  Click the map where you think they were born.`



  resultDiv.innerHTML = ""

  nextBtn.style.display = "none"



  photo.style.display = "none"



  roundActive = true



  if(guessMarker) guessMarker.remove()

  if(answerMarker) answerMarker.remove()



  if(map.getLayer("resultLine")){

    map.removeLayer("resultLine")

  }



  if(map.getSource("resultLine")){

    map.removeSource("resultLine")

  }



  resultLine = null



  loadWikipedia(person.properties.Name)



}



map.on("click", (e)=>{

  if(!roundActive) return
  if(currentIndex >= gamePeople.length) return

  roundActive = false

  const guess = [e.lngLat.lng, e.lngLat.lat]


if (guessMarker) {
  guessMarker.remove();
}

guessMarker = new maplibregl.Marker({
  color: "#007bff"
})
.setLngLat(guess)
.addTo(map);
  const person = gamePeople[currentIndex]
  const actual = person.geometry.coordinates

  const distance = getDistanceKm(
    guess[1], guess[0],
    actual[1], actual[0]
  )

  const score = calculateScore(distance)

  guesses.push({
    name: person.properties.Name,
    guess,
    actual,
    distance,
    score
  });

  // Only store GOOD guesses (<= 200 km) and only in world mode
if(!currentCountryBounds && distance <= 200){
  addMasteredPerson(person.properties.Name);
}

  
  showResult(distance, actual);

}); 

function showResult(distance, actual){



  const person = gamePeople[currentIndex]



// Create marker container
const el = document.createElement("div");
el.className = "answer-marker";

el.style.width = "50px";
el.style.height = "50px";
el.style.display = "block";
el.style.background = "red"; // temporary debug
    

const photoUrl = wikiPhotos[currentIndex];

const img = document.createElement("img");
img.src = photoUrl;

img.style.width = "50px";
img.style.height = "50px";
img.style.borderRadius = "50%";
img.style.objectFit = "cover";
img.style.border = "3px solid white";
img.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";

answerMarker = new maplibregl.Marker({
  element: img,
  anchor: "center"
})
.setLngLat(actual)
.addTo(map);
    
    map.addSource("resultLine", {

  type: "geojson",

  data: {

    type: "Feature",

    geometry: {

      type: "LineString",

      coordinates: [guesses[currentIndex].guess, actual]

    }

  }

})



map.addLayer({

  id: "resultLine",

  type: "line",

  source: "resultLine",

  paint: {

    "line-color": "#444",

    "line-width": 2,

    "line-dasharray": [2,2]

  }

})



resultLine = true



  const bounds = new maplibregl.LngLatBounds()



bounds.extend(guesses[currentIndex].guess)

bounds.extend(actual)



map.fitBounds(bounds, {
  padding: {
    top: 80,
    bottom: 80,
    left: 80,
    right: 420
  },
  duration: 1500
});



const score = guesses[currentIndex].score

// progress bar update
const percent = score / 5000 * 100
document.getElementById("scoreFill").style.width = percent + "%"
    
let html =

`You were <b>${Math.round(distance)} km</b> away.<br>

<b>Score:</b> ${score} / 5000<br><br>

<b>Birthplace:</b> ${person.properties["Birth City"]},

${person.properties["Birth Country"]}<br><br>`



  if(wikiData){



    let shortBio = ""



    if(wikiData.extract){

      shortBio =

      wikiData.extract.split('. ').slice(0,2).join('. ') + '.'

    }



    html += `

    <div style="margin-top:6px;font-size:13px">

    ${shortBio}<br><br>

    <a href="${wikiData.content_urls.desktop.page}"

    target="_blank">

    Read more on Wikipedia →

    </a>

    </div>

    `

  }



  resultDiv.innerHTML = html



  nextBtn.style.display = "block"



}





nextBtn.onclick = () => {
  currentIndex++;

  if(currentIndex >= gamePeople.length){
    showSummary();
    return;
  }

  // If we have country bounds, fit the map to them. 
  // Otherwise, go back to the world view.
  if (currentCountryBounds) {
    map.fitBounds(currentCountryBounds, {
      padding: 100,
      duration: 1500,
      essential: true
    });
  } else {
    map.flyTo({
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      duration: 1500
    });
  }

  askQuestion();
};
    
function showSummary(){



  const overlay = document.getElementById("summaryOverlay")

  const grid = document.getElementById("summaryGrid")



  grid.innerHTML = ""



  let totalScore = 0



  guesses.forEach((g,i)=>{



    totalScore += g.score



    const photoUrl = wikiPhotos[i] || ""



    let scoreClass = "scoreTerrible"



if(g.score > 4000) scoreClass = "scoreGreat"

else if(g.score > 2500) scoreClass = "scoreGood"

else if(g.score > 1000) scoreClass = "scoreBad"  



    const card = document.createElement("div")

    card.className = "personCard"



    card.innerHTML = `

      ${photoUrl ? `<img src="${photoUrl}">` : ""}

      <div class="personName">${g.name}</div>

      <div class="personScore ${scoreClass}">

        ${g.score} points<br>

        ${Math.round(g.distance)} km

      </div>

    `



    grid.appendChild(card)



  })



  document.getElementById("summaryTitle").innerHTML =

  `Game Results — Total Score: ${totalScore} / 50000`



  

  document.getElementById("summaryOverlay").style.display = "flex"  

}



function shuffle(array){



  for (let i = array.length - 1; i > 0; i--) {



    const j = Math.floor(Math.random() * (i + 1))



    ;[array[i], array[j]] = [array[j], array[i]]



  }



  return array



}





document.getElementById("playAgainBtn").onclick = () => {

  // Hide the summary overlay
  document.getElementById("summaryOverlay").style.display = "none";

  // Reset wiki photos
  wikiPhotos = [];

  // Reset map view
  map.flyTo({
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM
  });

  // Show the welcome screen instead of starting the game
  document.getElementById("welcomeOverlay").style.display = "flex";
};


// Haversine formula

function getDistanceKm(lat1,lon1,lat2,lon2){



  const R = 6371



  const dLat = (lat2-lat1)*Math.PI/180

  const dLon = (lon2-lon1)*Math.PI/180



  const a =

    Math.sin(dLat/2)*Math.sin(dLat/2) +

    Math.cos(lat1*Math.PI/180) *

    Math.cos(lat2*Math.PI/180) *

    Math.sin(dLon/2)*Math.sin(dLon/2)



  const c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))



  return R*c



}



function calculateScore(distance){



  const scale = 2000



  const score = 5000 * Math.exp(-distance / scale)



  return Math.round(score)



}

// World Game button
document.getElementById("worldGameBtn").onclick = () => {
  // Hide the welcome overlay
  document.getElementById("welcomeOverlay").style.display = "none";

  // Start the existing game logic (all people, random 10)
  startGame();
};

document.getElementById("backToChoice").onclick = () => {
  // Hide the country list panel
  document.getElementById("countryListPanel").style.display = "none";
  
  // Show the initial welcome choice panel
  document.getElementById("welcomeChoice").style.display = "flex";
};

document.getElementById("resultsBtn").onclick = () => {
  showResultsMap();
};

function showResultsMap() {

     // 🔥 CLEAN UP OLD GAME VISUALS FIRST

  // Remove answer marker
  if (answerMarker) {
    answerMarker.remove();
    answerMarker = null;
  }

  // Remove guess marker (if you ever use it)
  if (guessMarker) {
    guessMarker.remove();
    guessMarker = null;
  }

  // Remove result line layer + source
  if (map.getLayer("resultLine")) {
    map.removeLayer("resultLine");
  }

  if (map.getSource("resultLine")) {
    map.removeSource("resultLine");
  }

  resultLine = null;

  // ALSO clear any previous result markers (you already do this, keep it)
  if (window.resultMarkers) {
    window.resultMarkers.forEach(m => m.remove());
    window.resultMarkers = [];
  }
    
// 1. Try to find the panel
  let resultPanel = document.getElementById("resultspanel");

  // 2. If it doesn't exist yet, create it and attach it to the layout
  if (!resultPanel) {
    resultPanel = document.createElement("div");
    resultPanel.id = "resultspanel";
    document.getElementById("layout").appendChild(resultPanel);
  }

  // 3. NOW that we are 100% sure it exists, we can change the styles
  document.getElementById("panel").style.display = "none";
  resultPanel.style.display = "flex"; 

  // 4. Clear and rebuild the content
  resultPanel.innerHTML = "";

// Create Back button
const backButton = document.createElement("button");
backButton.textContent = "← Back";
backButton.style.padding = "10px";
backButton.style.marginBottom = "10px";
backButton.style.borderRadius = "8px";
backButton.style.border = "none";
backButton.style.cursor = "pointer";

// Back button logic
backButton.onclick = () => {
  // Remove results panel
  if (resultPanel) {
    resultPanel.style.display = "none";
  }

  // Remove result markers
  if (window.resultMarkers) {
    window.resultMarkers.forEach(m => m.remove());
    window.resultMarkers = [];
  }

  // Show welcome overlay
  const overlay = document.getElementById("welcomeOverlay");
  overlay.style.display = "flex";

  // Reset overlay panels
  document.getElementById("welcomeChoice").style.display = "";
  document.getElementById("countryListPanel").style.display = "none";

  // 🔥 Reset map view (important!)
  map.flyTo({
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM
  });

  
};
// Create Reset button
const resetButton = document.createElement("button");
resetButton.textContent = "Reset Progress";
resetButton.style.padding = "10px";
resetButton.style.borderRadius = "8px";
resetButton.style.border = "none";
resetButton.style.cursor = "pointer";
resetButton.style.background = "#ff4d4d";
resetButton.style.color = "white";

// Reset button logic
resetButton.onclick = () => {
  const confirmReset = confirm("Are you sure you want to reset all progress?");
  if (confirmReset) {
    localStorage.clear();
    alert("Progress reset!");
    location.reload(); // refresh to reset UI
  }
};


// Add buttons to panel
resultPanel.appendChild(backButton);

// Add results message
const message = document.createElement("p");
message.textContent = "The markers on this map show the birthplaces of notable people around the world whose birthplaces you identified to within 200km.";
message.style.marginBottom = "15px";
message.style.fontSize = "16px";
message.style.lineHeight = "1.4";

resultPanel.appendChild(message);
    
resultPanel.appendChild(resetButton);

  const mastered = getMasteredPeople();

  // Filter GeoJSON to only mastered people
  const masteredPeople = allPeople.filter(p =>
    mastered.includes(p.properties.Name)
  );

  // Remove old markers if needed
  if (window.resultMarkers) {
    window.resultMarkers.forEach(m => m.remove());
  }
  window.resultMarkers = [];

  // Add markers
  masteredPeople.forEach(async (person) => {
    const coords = person.geometry.coordinates;

    const img = document.createElement("img");
    img.style.width = "40px";
    img.style.height = "40px";
    img.style.borderRadius = "50%";
    img.style.objectFit = "cover";
    img.style.border = "2px solid white";

    const name = person.properties.Name;

    // If cached, use it
    if (wikiCache[name]?.thumbnail?.source) {
      img.src = wikiCache[name].thumbnail.source;
    } else {
      // Otherwise fetch it
      try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
        const res = await fetch(url);
        const data = await res.json();

        wikiCache[name] = data;

        if (data.thumbnail?.source) {
          img.src = data.thumbnail.source;
        }
      } catch (e) {
        console.log("Image load failed for", name);
      }
    }

    const marker = new maplibregl.Marker({ element: img })
  .setLngLat(coords)
  .addTo(map);

   window.resultMarkers.push(marker);   

// 👉 Handle click on marker
img.style.cursor = "pointer";

img.onclick = () => {
  // 1. Find or Create the Scroll Container (so buttons stay put)
  let scrollBox = resultPanel.querySelector(".scroll-container");
  if (!scrollBox) {
    // If it doesn't exist, we create it once
    scrollBox = document.createElement("div");
    scrollBox.className = "scroll-container";
    scrollBox.style.flex = "1";
    scrollBox.style.overflowY = "auto";
    scrollBox.style.minHeight = "0";
    scrollBox.style.marginTop = "10px";
    
    // Clear only the middle area, keep buttons
    resultPanel.innerHTML = ""; 
    resultPanel.appendChild(backButton);
    resultPanel.appendChild(scrollBox);
    resultPanel.appendChild(resetButton);
  }

  // 2. Clear ONLY the scrollBox content
  scrollBox.innerHTML = "";

  // 3. Get wiki data
  const data = wikiCache[name];

  // 4. Build the Bio HTML
  const info = document.createElement("div");
  let html = `
    <h2 style="margin-top:0;">${name}</h2>
    <p><strong>Birthplace:</strong> ${person.properties["Birth City"]}, ${person.properties["Birth Country"]}</p>
  `;

  if (data) {
    let shortBio = data.extract ? data.extract.split('. ').slice(0, 3).join('. ') + '.' : "";
    html += `
      <div style="margin-top:6px;font-size:14px;line-height:1.5;">
        ${shortBio}<br><br>
        <a href="${data.content_urls?.desktop?.page}" target="_blank" style="color:#007bff;text-decoration:none;font-weight:bold;">
          Read more on Wikipedia →
        </a>
      </div>
    `;
  }

  info.innerHTML = html;

  // 5. Add Image
  const largeImg = document.createElement("img");
  largeImg.src = img.src;
  largeImg.style.width = "100%";
  largeImg.style.maxHeight = "200px";
  largeImg.style.objectFit = "cover";
  largeImg.style.borderRadius = "10px";
  largeImg.style.marginTop = "15px";

  // 6. Append to the SCROLL BOX
  scrollBox.appendChild(largeImg);
  scrollBox.appendChild(info);
  
  // Auto-scroll to top of the new bio
  scrollBox.scrollTop = 0;
};
    
  });

  // Fit map to markers
  if (masteredPeople.length > 0) {
    const bounds = new maplibregl.LngLatBounds();

    masteredPeople.forEach(p => {
      bounds.extend(p.geometry.coordinates);
    });

    map.fitBounds(bounds, {
      padding: 100,
      duration: 1500
    });
  } else {
    
  }

  // Hide overlays if needed
  document.getElementById("welcomeOverlay").style.display = "none";
}
