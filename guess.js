const INITIAL_CENTER = [13.388, 52.517]

const INITIAL_ZOOM = 2



const map = new maplibregl.Map({
  style: 'https://tiles.openfreemap.org/styles/bright',
  center: INITIAL_CENTER,
  zoom: INITIAL_ZOOM,
  container: 'map',
  // Add your custom attribution here
  customAttribution: 'Notable People Data <a href="https://www.kaggle.com/datasets/beridzeg45/famous-people-through-the-ages" target="_blank">beridzeg45 on Kaggle</a>'
})


let allPeople = []

let gamePeople = []

let currentIndex = 0

let guesses = []

let wikiData = null

let roundActive = true

let resultLine = null

let wikiPhotos = []



let guessMarker = null

let answerMarker = null



const questionDiv = document.getElementById("question")

const resultDiv = document.getElementById("result")

const nextBtn = document.getElementById("nextBtn")

const photo = document.getElementById("photo")





// Load GeoJSON

fetch("https://mapsmania.github.io/inventions/notable_people.geojson")

.then(res => res.json())

.then(data => {



  allPeople = data.features



  startGame()



})



function startGame(){



  document.getElementById("summaryOverlay").style.display = "none"



  gamePeople = shuffle(allPeople).slice(0,10)



  currentIndex = 0

  guesses = []



  askQuestion()



}





async function loadWikipedia(personName){



  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(personName)}`



  try{



    const res = await fetch(url)

    const data = await res.json()



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



function askQuestion(){



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

})



  guessMarker = new maplibregl.Marker({color:"blue"})

    .setLngLat(guess)

    .addTo(map)



  showResult(distance, actual)



})





function showResult(distance, actual){



  const person = gamePeople[currentIndex]



  answerMarker = new maplibregl.Marker({color:"green"})

  .setLngLat(actual)

  .addTo(map)



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

  padding: 80,

  duration: 1500

})



  const score = guesses[currentIndex].score



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





nextBtn.onclick = ()=>{



  currentIndex++



  if(currentIndex >= gamePeople.length){

    showSummary()

    return

  }



  map.flyTo({

    center: INITIAL_CENTER,

    zoom: INITIAL_ZOOM

  })



  askQuestion()



}



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





document.getElementById("playAgainBtn").onclick = ()=>{



  document.getElementById("summaryOverlay").style.display = "none"

  

  wikiPhotos = []



  map.flyTo({

    center: INITIAL_CENTER,

    zoom: INITIAL_ZOOM

  })



  startGame()

}





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
