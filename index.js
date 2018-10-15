const currentVideoWrapper = document.getElementById('current-video-wrapper')
const currentVideo = currentVideoWrapper.querySelector('video')
const images = Array.from(document.querySelectorAll('.anlagen-fotos img'))
const imageWrappers = Array.from(
  document.querySelectorAll('.anlagen-fotos .image-wrapper')
)
const loader = document.getElementById('loader')
const videoUrls = images.map(image => image.dataset.video)
const playButton = document.getElementById('play')
const closeButton = document.getElementById('close')

let isAnimating = false

const videoCache = {}

if ('requestIdleCallback' in window) {
  // precache videos from indexedDB
  requestIdleCallback(async () => {
    for (const videoUrl of videoUrls) {
      if (databaseInitialized) {
        await getVideo(database, videoUrl)
      }
    }
  })
}

// setTimeout(() => {
//   imageWrappers[0].click()
// }, 100)

async function animate(element1, element2) {
  isAnimating = true
  return new Promise(resolve => {
    element1.classList.remove('hidden')
    ramjet.transform(element2, element1, {
      duration: 400,
      done() {
        element1.classList.remove('hidden')
        resolve()
      },
    })
    element1.classList.add('hidden')
    element2.classList.add('hidden')
  })
}

// let isFullScreen = false

// if (currentVideo.requestFullscreen) {
//   currentVideo.requestFullscreen()
//   // @ts-ignore
// } else if (currentVideo.mozRequestFullScreen) {
//   // @ts-ignore
//   currentVideo.mozRequestFullScreen()
// } else if (currentVideo.webkitRequestFullscreen) {
//   currentVideo.webkitRequestFullscreen()
//   // @ts-ignore
// } else if (currentVideo.msRequestFullscreen) {
//   // @ts-ignore
//   currentVideo.msRequestFullscreen()
// }

// if (document.onfullscreenchange === null)
//   document.onfullscreenchange = onFullScreenChange
// else if (document.onmsfullscreenchange === null)
//   document.onmsfullscreenchange = onFullScreenChange
// else if (document.onmozfullscreenchange === null)
//   document.onmozfullscreenchange = onFullScreenChange
// else if (document.onwebkitfullscreenchange === null)
//   document.onwebkitfullscreenchange = onFullScreenChange

// async function onFullScreenChange() {
//   console.log('fullscreen change')
//   isFullScreen = !isFullScreen
//   if (!isFullScreen) {
//     console.log('remove')
//     // if(currentVideo)
//     currentVideo.pause()
//     currentVideo.removeAttribute('src')
//     currentVideoWrapper.classList.remove('visible')
//     // imageWrapper.classList.remove('hidden')
//     // await animate(image, currentVideo)
//     // imageWrapper.classList.remove('hidden')
//     currentVideoWrapper.classList.add('hidden')
//     // isAnimating = false
//     currentVideoWrapper.style.pointerEvents = 'none'
//     // }
//   }
// }

currentVideo.onplaying = () => {
  loader.hidden = true
}

async function hideVideo(imageWrapper, image) {
  currentVideo.pause()
  playButton.hidden = true
  currentVideo.removeAttribute('src')
  currentVideoWrapper.classList.remove('visible')
  imageWrapper.classList.remove('hidden')

  await animate(image, currentVideo)
  imageWrapper.classList.remove('hidden')
  currentVideoWrapper.classList.add('hidden')
  isAnimating = false
  currentVideoWrapper.style.pointerEvents = 'none'
  document.body.style.overflow = 'auto'
}

function setSeekbarPosition() {
  document.getElementById(
    'custom-seekbar'
  ).style.marginTop = `${currentVideo.offsetHeight / 2 - 5}px`
}

window.addEventListener('resize', setSeekbarPosition)
window.addEventListener('orientationchange', setSeekbarPosition)

imageWrappers.forEach(imageWrapper => {
  imageWrapper.addEventListener('click', async () => {
    console.log('show loader')
    if (isAnimating) {
      return
    }
    const image = imageWrapper.querySelector('img')
    currentVideo.setAttribute('poster', image.src)
    // currentVideo.setAttribute('controls', '')
    currentVideo.removeAttribute('autoplay')

    // if (currentVideo.requestFullscreen) currentVideo.requestFullscreen()
    // else if (currentVideo.msRequestFullscreen) currentVideo.msRequestFullscreen()
    // else if (currentVideo.mozRequestFullScreen) currentVideo.mozRequestFullScreen()
    // else if (currentVideo.webkitRequestFullscreen) currentVideo.webkitRequestFullscreen()

    const videoSrcPromise = new Promise(async resolve => {
      if (videoCache[image.dataset.video]) {
        console.log('video from cache :)')
        return resolve(videoCache[image.dataset.video])
      }
      const videoSrc =
        (await getVideo(database, image.dataset.video)) || image.dataset.video
      resolve(videoSrc)
    })
    currentVideoWrapper.classList.remove('hidden')
    currentVideoWrapper.classList.add('visible')
    document.body.style.overflow = 'hidden'

    const animationPromise = animate(currentVideo, imageWrapper)

    loader.hidden = false

    // console.log('await promise')
    const videoSrc = await videoSrcPromise
    // console.log('promise resolved')
    if (videoSrc) {
      console.log('set src')
      // console.log(currentVideo.offsetHeight)
      document.querySelector('#custom-seekbar span').style.width = '0'

      currentVideo.setAttribute('src', videoSrc)
      currentVideo.setAttribute('autoplay', '')
      await animationPromise
      isAnimating = false
      currentVideoWrapper.style.pointerEvents = 'all'
      setSeekbarPosition()
    } else {
      console.error('no video for', imageWrapper.src)
    }
    currentVideoWrapper.onclick = async event => {
      if (event.target !== currentVideo) {
        hideVideo(imageWrapper, image)
      }
    }

    closeButton.onclick = () => {
      hideVideo(imageWrapper, image)
    }
    currentVideo.onclick = async () => {
      if (currentVideo.paused) {
        currentVideo.play()
        playButton.hidden = true
      } else {
        currentVideo.pause()
        playButton.hidden = false
      }
    }
  })
})

//
// ─── BEGIN IDB ──────────────────────────────────────────────────────────────────
//

const saveVideosButton = document.getElementById('save-videos')
if (localStorage.getItem('VIDEOS_SAVED') === 'TRUE') {
  saveVideosButton.style.display = 'none'
}
saveVideosButton.addEventListener('click', async () => {
  for (const videoUrl of videoUrls) {
    try {
      const result = await getVideo(database, videoUrl)
      if (result) {
        continue
      } else {
        console.log('saving videos')
        await saveVideo(database, videoUrl)
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (error) {
      console.error('video not available due to', JSON.stringify(error))
      if (dev) {
        const info = document.createElement('i')
        info.style.color = 'red'
        info.innerText = 'video not available due to'
        $info.appendChild(info)
      }
    }
  }
  localStorage.setItem('VIDEOS_SAVED', 'TRUE')
  saveVideosButton.style.display = 'none'
})
const dev = false

async function getArrayBuffer(videoUrl) {
  console.info('fetch video: ', videoUrl)
  let arrayBuffer
  try {
    arrayBuffer = await fetch(videoUrl).then(res => res.arrayBuffer())
  } catch (error) {
    if (dev) {
      const info = document.createElement('i')
      info.style.color = 'red'
      info.innerText = `could not fetch video`
      $info.appendChild(info)
    }
  }
  console.info('arrayBuffer: ', arrayBuffer)

  return arrayBuffer
}

function toBlob(arrayBuffer) {
  return new Blob([arrayBuffer], { type: 'video/mp4' })
}

async function getRemainingStorage() {
  if (navigator.storage) {
    return navigator.storage.estimate().then(data => data.quota - data.usage)
  }
  return Infinity
}

const $info = document.getElementById('info')

// variables to run database
let database
let idbRequest
let databaseInitialized = false

async function initDatabase() {
  return new Promise(resolve => {
    // request to open the specified database by name and version number
    // if version number changes, the database is updated
    idbRequest = window.indexedDB.open('index-db', 1)

    // if there is an error, tell the error
    idbRequest.addEventListener('error', event => {
      alert('Could not open Indexed DB due to error' + event)
    })

    /**
     * if the database you specified cannot be found or the version number is old, you will need an upgrade to create the new database schema
     */
    idbRequest.addEventListener('upgradeneeded', event => {
      const { result } = event.target
      /**
       * here we create a new object store called data, and give it an auto-generated key path
       */
      const storage = result.createObjectStore('data', { autoIncrement: true })
    })

    idbRequest.addEventListener('success', async function(event) {
      database = this.result // store database for later use
      resolve()
      databaseInitialized = true
    })
  })
}

async function saveVideo(database, videoUrl) {
  return new Promise(async (resolve, reject) => {
    console.log('save')
    const arrayBuffer = await getArrayBuffer(videoUrl)
    console.log(arrayBuffer)
    if (arrayBuffer.byteLength >= (await getRemainingStorage())) {
      if (dev) {
        const info = document.createElement('i')
        info.style.color = 'red'
        info.innerText = `not enough space for saving video, return`
        $info.appendChild(info)
      }
      return resolve()
    }

    const transaction = database
      .transaction('data', 'readwrite')
      .objectStore('data')

    const getTransaction = transaction.get('save-data')

    getTransaction.addEventListener('success', async event => {
      const result = event.target.result || {}
      result.video = arrayBuffer
      const request = transaction.put(result, videoUrl)

      request.onsuccess = () => {
        if (dev) {
          const info = document.createElement('i')
          info.style.color = 'green'
          info.innerText = `Video ${videoUrl} saved in database`
          $info.appendChild(info)
        }
        console.info('video saved')
        resolve()
      }
      request.onerror = reject
    })
    getTransaction.addEventListener('error', reject)
  })
}

async function getVideo(database, videoUrl) {
  return new Promise(resolve => {
    if (!database) {
      resolve(null)
    }
    const storage = database
      .transaction('data', 'readwrite')
      .objectStore('data')

    storage.get(videoUrl).addEventListener('success', async event => {
      const { result } = event.target

      if (result && result.video) {
        const arrayBuffer = result.video
        const blob = toBlob(arrayBuffer)
        const objectUrl = URL.createObjectURL(blob)
        videoCache[videoUrl] = objectUrl

        console.info('restored video from indexedDB')
        if (dev) {
          const info = document.createElement('i')
          info.innerText = `Video ${videoUrl} restored from  database`
          info.style.color = 'green'
          $info.appendChild(info)
        }
        resolve(objectUrl)
      } else {
        resolve(null)
      }
    })
  })
}

initDatabase()

// Begin custom seekbar
currentVideo.ontimeupdate = function() {
  var percentage = (currentVideo.currentTime / currentVideo.duration) * 100
  document.querySelector('#custom-seekbar span').style.width = `${percentage}%`
}

function onSeekbarClick(event) {
  event.stopPropagation()
  const x =
    event.pageX || (event.touches && event.touches[0].clientX) || undefined
  console.log(x)
  var customSeekbar = document.getElementById('custom-seekbar')
  if (!isNaN(x) && isFinite(x)) {
    console.log(x / customSeekbar.clientWidth)
    document.querySelector('#custom-seekbar span').style.width = `${(x /
      customSeekbar.clientWidth) *
      100}%`
  }

  var left = x - customSeekbar.offsetLeft
  var totalWidth = parseInt(
    document.getElementById('custom-seekbar').offsetWidth
  )
  var percentage = left / totalWidth
  var currentVideoTime = currentVideo.duration * percentage
  if (!isNaN(currentVideoTime) && isFinite(currentVideoTime)) {
    currentVideo.currentTime = currentVideoTime
  }
}

function throttled(delay, fn) {
  let lastCall = 0
  return function(...args) {
    const now = new Date().getTime()
    if (now - lastCall < delay) {
      return
    }
    lastCall = now
    return fn(...args)
  }
}
document
  .getElementById('custom-seekbar')
  .addEventListener('click', onSeekbarClick)
document
  .getElementById('custom-seekbar')
  .addEventListener('touchstart', onSeekbarClick)
document
  .getElementById('custom-seekbar')
  .addEventListener('touchstart', onSeekbarClick)
document
  .getElementById('custom-seekbar')
  .addEventListener('touchmove', onSeekbarClick)
