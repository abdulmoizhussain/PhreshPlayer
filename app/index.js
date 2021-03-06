
const windowtitle = document.getElementById('windowtitle');
const content = document.getElementById('content');
const toasts = document.getElementById('toasts');
const videoplayer = document.getElementById('videoplayer');
const subtitleContainer = document.getElementById("subtitleContainer");
const playing = document.getElementById('playing');
const controls = document.getElementById('controls');
const playbutton = document.getElementById('playbutton');
const pausebutton = document.getElementById('pausebutton');
const currSubNum = document.getElementById('currSubNum');
const allSubNum = document.getElementById('allSubNum');
const allSkipNum = document.getElementById('allSkipNum');
const currSkipNum = document.getElementById('currSkipNum');
const currLangNum = document.getElementById('currLangNum');
const allLangNum = document.getElementById('allLangNum');
const playlistholder = document.getElementById('playlistholder');
const playlist = document.getElementById('playlist');
const playprogressholder = document.getElementById('playprogressholder');
const playprogress = document.getElementById('playprogress');
const elapsedtime = document.getElementById('elapsedtime');
const reamingtime = document.getElementById('reamingtime');
const convertmodal = document.getElementById('convertmodal');
const convertmodalcontent = document.getElementById('convertmodalcontent');

const os = process.platform;
const electron = require('electron');
const { remote, ipcRenderer } = require('electron');
const app = electron.app || electron.remote.app;
const currentWindow = remote.getCurrentWindow();
const Mousetrap = require('mousetrap');
const { dialog } = require('electron').remote;
const fs = require('fs');
const path = require('path');
const srt2vtt = require('srt2vtt');
/* Only Windows & Linux support ffmpeg, as i know */
const ffmpeg = require('fluent-ffmpeg');
const __desktopEnv = require('desktop-env');
const Constants = require("./js/constants.js");
const playlistjs = require("./js/playlist.js");
const playerjs = require('./js/player.js');

let __setTimeoutIdForSkipper;

if (os === 'win32') {
  ffmpeg.setFfmpegPath(path.join(__dirname, '..', '..', 'app.asar.unpacked', 'node_modules', 'ffmpeg-binaries', 'bin', 'ffmpeg.exe'));
  ffmpeg.setFfprobePath(path.join(__dirname, '..', '..', 'app.asar.unpacked', 'node_modules', 'ffmpeg-binaries', 'bin', 'ffprobe.exe'));
}

const Datastore = require('nedb');
const appDir = app.getPath('userData');
const playlistfile = new Datastore({ filename: appDir + '/playlist.db', autoload: true });

const Store = require('electron-store');
const store = new Store();
let currentFileName = "", currentFilePath = "";

if (!store.has('settings.do_skipping'))
  store.set('settings.do_skipping', false);

let doSkipping = store.get('settings.do_skipping');

if (store.has('settings.volume')) {
  let currVolume = store.get('settings.volume');
  videoplayer.volume = currVolume;
}

if (store.has('settings.alwaysontop')) {
  let alwaysOnTop = store.get('settings.alwaysontop');
  if (alwaysOnTop) {
    currentWindow.setAlwaysOnTop(true);
  } else {
    currentWindow.setAlwaysOnTop(false);
  }
} else {
  store.set('settings.alwaysontop', false);
}

if (store.has('settings.showplaylist')) {
  let showPlaylist = store.get('settings.showplaylist');
  if (showPlaylist) {
    playlist.style.display = 'block';
    videoplayer.style.width = '60%';
    w3.addClass('#playlistbutton', 'activated');
  } else {
    playlist.style.display = 'none';
    videoplayer.style.width = '100%';
    w3.removeClass('#playlistbutton', 'activated');
  }
} else {
  store.set('settings.showplaylist', true);
}

let showSubtitle;

if (store.has('settings.showsubtitle')) {
  showSubtitle = store.get('settings.showsubtitle');
} else {
  store.set('settings.showsubtitle', false);
  showSubtitle = false;
}

let skipDurations = [];


if (!store.has('settings.subtitlelanguage')) {

  if (store.has('settings.language')) {
    storedLanguage = store.get('settings.language');
    store.set('settings.subtitlelanguage', storedLanguage);
  } else {
    store.set('settings.subtitlelanguage', 'en');
  }

}

/* audiolang come here, at one time.. */

let supportedFileTypes = [
  "video/webm",
  "video/x-matroska",
  "video/mp4",
  "video/ogg",
  "video/quicktime",
  "audio/mp3",
  "audio/flac"
];
let supportedFileExts = [
  ".webm",
  ".mkv",
  ".mp4",
  ".ogg",
  ".mov",
  ".mp3",
  ".flac"
];

// let w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
let h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
content.style.height = h + "px";
videoplayer.style.height = h + "px";
playlist.style.height = h + "px";

/* Listeners */

electron.ipcRenderer.on('callFunction', function (event, functionName, functionParam) {
  switch (functionName) {
    case "setLanguage":
      setLanguage(functionParam);
      break;
    case "setSubtitleLanguage":
      setSubtitleLanguage(functionParam);
      break;
    case "toggleFullScreen":
      toggleFullScreen();
      break;
    case "toggleAllwaysOnTop":
      toggleAllwaysOnTop();
      break;
    /* Player */
    case "volumeMute":
      playerjs.volumeMute();
      break;
    case "loopVideo":
      playerjs.loopVideo();
      break;
    case "toggleShowSubtitle":
      playerjs.toggleShowSubtitle();
      break;
    /* Playlist */
    case "toggleShowPlaylist":
      playlistjs.toggleShowPlaylist();
      break;
    case "savePlaylist":
      playlistjs.savePlaylist();
      break;
  }
});

currentWindow.on('resize', function () {
  // w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  content.style.height = h + "px";
  videoplayer.style.height = h + "px";
  playlist.style.height = h + "px";
});

let controlsAreVisible;
let hideControlsAlowed = true;

document.addEventListener("mousemove", function (e) {
  showControls();
  hideControls();
}, false);

controls.addEventListener("mouseenter", function (e) {
  hideControlsAlowed = false;
  document.removeEventListener("mousemove", showControls(), false);
}, false);
controls.addEventListener("mouseleave", function (e) {
  hideControlsAlowed = true;
  document.addEventListener("mousemove", hideControls(), false);
}, false);

videoplayer.addEventListener("timeupdate", function (e) {

  let currPlay = playing.getAttribute("data");
  let mediaDuration = videoplayer.duration;
  let currTime = videoplayer.currentTime;
  let reamingTime = mediaDuration - currTime;

  // check and skip scene at next-second, if its skippable.
  playerjs.checkAndSkipScene(false, currTime, 1);

  let currPercentage = Math.floor(100 * currTime / mediaDuration);
  let currPercentageToTasKbar = Math.max(currPercentage / 100);

  if (reamingTime <= 1) {
    let currPlay = playing.getAttribute("data");
    let nextPlay = parseInt(currPlay) + 1;
    playerjs.playNext();
  }

  playprogress.style.width = currPercentage + '%';
  playprogress.innerHTML = currPercentage + '%';

  elapsedtime.innerHTML = getVideoTime(currTime * 1000);
  reamingtime.innerHTML = '- ' + getVideoTime(reamingTime * 1000);

  if (os === 'linux') {
    __desktopEnv().then(currEnv => {
      if (currEnv === 'Unity') {
        if (currPercentageToTasKbar !== NaN) {
          currentWindow.setProgressBar(currPercentageToTasKbar);
        }
      }
    });
  } else {
    if (currPercentageToTasKbar !== NaN) {
      try {
        currentWindow.setProgressBar(currPercentageToTasKbar);
      } catch (err) {
        // console.error(err);
      }
    }
  }
}, false);

videoplayer.addEventListener("mousewheel", function (e) {
  let delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
  if (delta === 1) {
    playerjs.volumeControl("up");
  } else if (delta === -1) {
    playerjs.volumeControl("down");
  }
}, false);

videoplayer.addEventListener("error", function (e) {
  console.log("error listener:");
  console.log(e);
  let playedId = playing.getAttribute('data');
  document.getElementById('vid-' + playedId).style.color = 'red';
  playerjs.playNext();
}, false);

playprogressholder.addEventListener("click", function (e) {
  const percent = e.offsetX / this.offsetWidth;
  const clickTime = percent * videoplayer.duration;

  if (playerjs.checkAndSkipScene(true, clickTime)) {
    return;
  }

  videoplayer.currentTime = clickTime;
  playprogress.style.width = percent / 100 + "%";
}, false);

/* File drops */
playlist.ondragover = () => { return false; };
playlist.ondragleave = () => { return false; };
playlist.ondragend = () => { return false; };
playlist.ondrop = (e) => {
  e.preventDefault();

  let newid = playlist.getElementsByTagName('li').length;
  let newvideos = [];
  let convertvideos = [];

  let iDroppedItemIdx = 0;

  for (let f of e.dataTransfer.files) {
    let filePath = f.path;
    let fileName = f.name;
    if (fileName === '') {
      /* On Linux f.name is empty when contains unicode characters (é, á, etc) */
      let filePathParts = filePath.split('/');
      let lastFilePathPart = filePathParts.length - 1;
      fileName = filePathParts[lastFilePathPart];
    }

    let droppedIsDir = fs.lstatSync(filePath).isDirectory();

    if (droppedIsDir) {

      let folderFiles = fs.readdirSync(filePath);
      for (let ii = 0; ii < folderFiles.length; ii++) {

        let fileInFolderPath = path.join(filePath, folderFiles[ii]);
        let fileInFolderName = folderFiles[ii];
        let fileInFolderExt = path.extname(folderFiles[ii]);

        if (supportedFileExts.indexOf(fileInFolderExt) !== -1) {

          newid++;
          let newvideo = {
            _id: newid,
            _name: fileInFolderName,
            _path: fileInFolderPath
          };
          newvideos.push(newvideo);

        } else {

          if (fileInFolderExt === '.pppl') {

            /* my own playlist file :P */
            setTimeout(function () {
              // w8 a bit while the direct files drop handling
              playlistjs.readPlaylistFile(fileInFolderPath);
            }, 300);

          } else {

            if (fileInFolderExt === '.avi' || fileInFolderExt === '.wmv') {

              let convertvideo = {
                name: fileInFolderName,
                path: fileInFolderPath
              };
              convertvideos.push(convertvideo);

            }

          }

        }

      }

    } else {

      if (supportedFileTypes.indexOf(f.type) !== -1) {

        newid++;
        let newvideo = {
          _id: newid,
          _name: fileName,
          _path: filePath
        };
        newvideos.push(newvideo);

      } else {

        let fileExt = path.extname(e.dataTransfer.files[iDroppedItemIdx].path);

        if (fileExt === '.pppl') {

          /* my own playlist file :P */
          setTimeout(function () {
            // w8 a bit while the direct files drop handling
            playlistjs.readPlaylistFile(filePath);
          }, 300);

        } else {

          if (fileExt === '.avi' || fileExt === '.wmv') {

            let convertvideo = {
              name: fileName,
              path: filePath
            };
            convertvideos.push(convertvideo);

          }

        }

      }

    }

    iDroppedItemIdx++;

  }

  playlistjs.addToPlaylist(newvideos);

  if (convertvideos.length > 0) {
    prepare2Convert(convertvideos);
  }

  return false;
};

videoplayer.ondragover = () => { return false; };
videoplayer.ondragleave = () => { return false; };
videoplayer.ondragend = () => { return false; };
videoplayer.ondrop = (e) => {
  e.preventDefault();

  playlist.innerHTML = '';
  playlistfile.remove({}, { multi: true }, function (err, numRemoved) { });

  let newid = 0;
  let newvideos = [];
  let convertvideos = [];

  let iDroppedItemIdx = 0;

  for (let f of e.dataTransfer.files) {

    let filePath = f.path;
    let fileName = f.name;
    if (fileName === '') {
      let filePathParts = filePath.split('/');
      let lastFilePathPart = filePathParts.length - 1;
      fileName = filePathParts[lastFilePathPart];
    }

    let droppedIsDir = fs.lstatSync(filePath).isDirectory();

    if (droppedIsDir) {

      let folderFiles = fs.readdirSync(filePath);
      for (let ii = 0; ii < folderFiles.length; ii++) {

        let fileInFolderPath = path.join(filePath, folderFiles[ii]);
        let fileInFolderName = folderFiles[ii];
        let fileInFolderExt = path.extname(folderFiles[ii]);

        if (supportedFileExts.indexOf(fileInFolderExt) !== -1) {

          newid++;
          let newvideo = {
            _id: newid,
            _name: fileInFolderName,
            _path: fileInFolderPath
          };
          newvideos.push(newvideo);

        } else {

          if (fileInFolderExt === '.pppl') {

            /* my own playlist file :P */
            setTimeout(function () {
              // w8 a bit while the direct files drop handling
              playlistjs.readPlaylistFile(fileInFolderPath);
            }, 300);

          } else {

            if (fileInFolderExt === '.avi' || fileInFolderExt === '.wmv') {

              let convertvideo = {
                name: fileInFolderName,
                path: fileInFolderPath
              };
              convertvideos.push(convertvideo);

            }

          }

        }

      }

    } else {

      if (supportedFileTypes.indexOf(f.type) !== -1) {

        newid++;
        let newvideo = {
          _id: newid,
          _name: fileName,
          _path: filePath
        };
        newvideos.push(newvideo);

      } else {

        let fileExt = path.extname(e.dataTransfer.files[iDroppedItemIdx].path);

        if (fileExt === '.pppl') {

          /* my own playlist file :P */
          setTimeout(function () {
            // w8 a bit while the direct files drop handling
            playlistjs.readPlaylistFile(filePath);
          }, 300);

        } else {

          if (fileExt === '.avi' || fileExt === '.wmv') {

            let convertvideo = {
              name: fileName,
              path: filePath
            };
            convertvideos.push(convertvideo);

          }

        }

      }

    }

    iDroppedItemIdx++;

  }

  playlistjs.addToPlaylist(newvideos);

  if (convertvideos.length > 0) {
    prepare2Convert(convertvideos);
  }

  setTimeout(function () { playerjs.playVideo(1); }, 1000);

  return false;
};

/* hotkeys */

Mousetrap.bind('f12', toggleDevTools);
Mousetrap.bind('l', playlistjs.toggleShowPlaylist);
Mousetrap.bind(['f', 'enter'], toggleFullScreen);

Mousetrap.bind('t', toggleAllwaysOnTop);

Mousetrap.bind('up', function () { playerjs.volumeControl("up"); });
Mousetrap.bind('down', function () { playerjs.volumeControl("down"); });
Mousetrap.bind('m', function () { playerjs.volumeMute("m"); });

Mousetrap.bind('left', function () { playerjs.seekVideo(Constants.Seek.BACKWARD); });
Mousetrap.bind('right', function () { playerjs.seekVideo(Constants.Seek.FORWARD); });

Mousetrap.bind('ctrl+left', playerjs.seekVideo.bind(null,
  Constants.Seek.BACKWARD, Constants.Seek.DURATION.LONG));

Mousetrap.bind('ctrl+right', playerjs.seekVideo.bind(null,
  Constants.Seek.FORWARD, Constants.Seek.DURATION.LONG));

Mousetrap.bind('n', playerjs.playNext);
Mousetrap.bind('b', playerjs.playPrev);
Mousetrap.bind('p', playerjs.playPrev);

Mousetrap.bind('space', function () {
  if (playbutton.style.display === 'none') {
    playerjs.handlePlayPause('pause');
  } else {
    playerjs.handlePlayPause('play');
    playerjs.loadSkipFile();
  }
});

Mousetrap.bind('q', function () {
  playerjs.setLastPlayed();
  currentWindow.close();
});

/* functions */
function setLanguage(language) {
  store.set('settings.language', language);
  app.relaunch();
  app.exit(0);
}

function setSubtitleLanguage(language) {
  store.set('settings.subtitlelanguage', language);
}

function toggleFullScreen() {
  let isInFullScreen = currentWindow.isFullScreen();
  if (isInFullScreen) {
    document.webkitCancelFullScreen();
    currentWindow.setFullScreen(false);
    setToast(i18n.__('fullscreen') + ' ' + i18n.__('off'));
  } else {
    currentWindow.setFullScreen(true);
    videoplayer.webkitEnterFullScreen();
    setToast(i18n.__('fullscreen') + ' ' + i18n.__('on'));
  }
}
function toggleAllwaysOnTop() {
  let isAlwaysOnTop = currentWindow.isAlwaysOnTop();
  if (isAlwaysOnTop) {
    store.set('settings.alwaysontop', false);
    currentWindow.setAlwaysOnTop(false);
    setToast(i18n.__('alwaysontop') + ' ' + i18n.__('off'));
  } else {
    store.set('settings.alwaysontop', true);
    currentWindow.setAlwaysOnTop(true);
    setToast(i18n.__('alwaysontop') + ' ' + i18n.__('on'));
  }
}

let toastInFire;
function setToast(toast) {
  toasts.innerHTML = toast;
  w3.show("#toasts");
  if (toastInFire === undefined) {
    toastInFire = setTimeout(function () { w3.hide("#toasts"); }, 3000);
  } else {
    clearTimeout(toastInFire);
    toastInFire = setTimeout(function () { w3.hide("#toasts"); }, 3000);
  }
}

function showControls() {
  clearTimeout(controlsAreVisible);
  controls.style.display = "block";
  videoplayer.style.cursor = "auto";
}
function hideControls() {
  if (hideControlsAlowed) {
    controlsAreVisible = setTimeout(function () {
      controls.style.display = videoplayer.style.cursor = "none";
    }, 1500);
  }
}

function getVideoTime(ms) {
  const date = new Date(ms);

  let tH = date.getUTCHours().toString();
  let tM = date.getUTCMinutes().toString();
  let tS = date.getUTCSeconds().toString();

  if (tH.length == 1) {
    tH = `0${tH}`;
  }
  if (tM.length == 1) {
    tM = `0${tM}`;
  }
  if (tS.length == 1) {
    tS = `0${tS}`;
  }

  return `${tH}:${tM}:${tS}`;
}

function prepare2Convert(convertvideos) {

  let convertFilesPromises = [];

  convertmodalcontent.innerHTML = '';
  w3.show('#convertmodal');

  for (let i = 0; i < convertvideos.length; i++) {

    let videoDir = path.dirname(convertvideos[i].path);
    let fileNameOnly = convertvideos[i].name.slice(0, -4);

    let input = convertvideos[i].path;
    let output = path.join(videoDir, fileNameOnly + '.mp4');

    let fileconvertbox = `
          <div id="convertbox-` + i + `" class="w3-panel w3-round w3-dark-grey fileconvertbox">
            <p>` + input + `</p>
            <div class="progressholder w3-light-grey w3-round-xlarge">
              <div id="cprs-` + i + `" class="progress w3-round-xlarge w3-center w3-green" style="width:0%;"></div>
            </div>
            <p>` + output + `</p>
          </div>`;
    convertmodalcontent.innerHTML += fileconvertbox;

    convertFilesPromises.push(convert2MP4(i, input, output));
  }

  Promise.all(convertFilesPromises)
    .then((results) => {
      console.log('All done: ' + results);
      w3.hide('#convertmodal');
    })
    .catch((e) => {
      console.log('Convert error: ' + e);
    });

}

function convert2MP4(boxnum, input, output) {

  return new Promise((resolve, reject) => {

    ffmpeg(input)
      .inputOptions([
        '-threads 1'
      ])
      .on('error', function (err) {
        console.log('An error occurred: ' + err.message);
        reject(err.message);
      })
      .on('progress', function (progress) {
        console.log('Processing: ' + input + ' - ' + progress.percent + '% done');
        document.getElementById('cprs-' + boxnum).style.width = Math.floor(progress.percent) + '%'
        document.getElementById('cprs-' + boxnum).innerHTML = Math.floor(progress.percent) + '%'
      })
      .on('end', function () {
        console.log('Processing finished!');
        document.getElementById('convertbox-' + boxnum).outerHTML = '';

        let newid = playlist.getElementsByTagName('li').length;
        let newvideos = [];

        newid++;
        let outputfilename = path.basename(output);

        let newvideo = {
          _id: newid,
          _name: outputfilename,
          _path: output
        };
        newvideos.push(newvideo);

        playlistjs.addToPlaylist(newvideos);

        resolve(output);
      })
      .renice(-5)
      .save(output);

  });

}

function convert2AAC(b) {

  w3.hide('#aacconvertspan');

  let fileconvertboxes = playlist.getElementsByClassName('fileconvertbox').length;
  let boxnum = fileconvertboxes + 1;
  let input = document.getElementById("aacconvertspan").getAttribute("data");
  let videoDir = path.dirname(input);
  let fileName = path.basename(input);
  let fileNameOnly = fileName.slice(0, -4);
  let output = path.join(videoDir, fileNameOnly + '_aac.mkv');

  w3.show('#convertmodal');

  let fileconvertbox = `
        <div id="convertbox-` + boxnum + `" class="w3-panel w3-round w3-dark-grey fileconvertbox">
          <p>` + input + `</p>
          <div class="progressholder w3-light-grey w3-round-xlarge">
            <div id="cprs-` + boxnum + `" class="progress w3-round-xlarge w3-center w3-green" style="width:0%;"></div>
          </div>
          <p>` + output + `</p>
        </div>`;
  convertmodalcontent.innerHTML += fileconvertbox;

  return new Promise((resolve, reject) => {

    ffmpeg(input)
      .inputOptions([
        '-threads 1'
      ])
      .audioCodec('aac')
      .on('error', function (err) {
        console.log('An error occurred: ' + err.message);
        reject(err.message);
      })
      .on('progress', function (progress) {
        console.log('Processing: ' + input + ' - ' + progress.percent + '% done');
        document.getElementById('cprs-' + boxnum).style.width = Math.floor(progress.percent) + '%'
        document.getElementById('cprs-' + boxnum).innerHTML = Math.floor(progress.percent) + '%'
      })
      .on('end', function () {
        console.log('Processing finished!');
        document.getElementById('convertbox-' + boxnum).outerHTML = '';

        let newid = playlist.getElementsByTagName('li').length;
        let newvideos = [];

        newid++;
        let outputfilename = path.basename(output);

        let newvideo = {
          _id: newid,
          _name: outputfilename,
          _path: output
        };
        newvideos.push(newvideo);

        playlistjs.addToPlaylist(newvideos);

        w3.hide('#convertmodal');

        resolve(output);
      })
      .renice(-5)
      .save(output);

  });

}

function toggleDevTools() {
  let DevIsOpened = currentWindow.webContents.isDevToolsOpened()
  if (DevIsOpened) {
    currentWindow.webContents.closeDevTools();
    w3.removeClass('#devtools', 'activated');
  } else {
    currentWindow.webContents.openDevTools();
    w3.addClass('#devtools', 'activated');
  }
}