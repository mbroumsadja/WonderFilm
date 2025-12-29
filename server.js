const { log } = require('console');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.static('public'));
const FILMS_DIR = path.join(__dirname, 'fimls'); // Dossier contenant les films

// Fonction pour scanner les dossiers et récupérer les films
function getFilms() {
    const films = [];
    if (fs.existsSync(FILMS_DIR)) {
        // Scanner les fichiers directement dans fimls
        const files = fs.readdirSync(FILMS_DIR);
        files.forEach(file => {
            const filePath = path.join(FILMS_DIR, file);
            if (fs.statSync(filePath).isFile() && path.extname(file).toLowerCase() === '.mp4') {
                const stat = fs.statSync(filePath);
                films.push({
                    name: path.parse(file).name,
                    path: file,
                    folder: 'Divers',
                    size: stat.size
                });
            }
        });

        // Scanner les sous-dossiers
        const folders = fs.readdirSync(FILMS_DIR);
        folders.forEach(folder => {
            const folderPath = path.join(FILMS_DIR, folder);
            if (fs.statSync(folderPath).isDirectory()) {
                const subFiles = fs.readdirSync(folderPath);
                subFiles.forEach(file => {
                    if (path.extname(file).toLowerCase() === '.mp4') {
                        const filePath = path.join(folderPath, file);
                        const stat = fs.statSync(filePath);
                        films.push({
                            name: path.parse(file).name,
                            path: path.join(folder, file),
                            folder: folder,
                            size: stat.size
                        });
                    }
                });
            }
        });
    }
    return films;
}

app.get('/', (req, res) => {
    const films = getFilms();
    let html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Mon Cinéma Local</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <h1>Streaming Local</h1>
    <div class="film-list">
`;
    films.forEach(film => {
        const encodedPath = encodeURIComponent(film.path);
        const sizeMB = (film.size / (1024 * 1024)).toFixed(2);
        html += `<div class="film-item" onclick="playFilm('${encodedPath}')">${film.folder}: ${film.name} (${sizeMB} MB)</div>`;
    });
    html += `
    </div>
    <div class="controls">
        <button onclick="stopVideo()">Arrêter la vidéo</button>
        <button onclick="fullscreenVideo()">Plein écran</button>
    </div>
    <video id="video-player" controls preload="none">
        Votre navigateur ne supporte pas la lecture vidéo.
    </video>

    <script>
        function playFilm(path) {
            const videoPlayer = document.getElementById('video-player');
            videoPlayer.src = '/play?path=' + path;
            videoPlayer.load();
            videoPlayer.play();
        }
        function stopVideo() {
            const videoPlayer = document.getElementById('video-player');
            videoPlayer.pause();
            videoPlayer.currentTime = 0;
            videoPlayer.src = '';
        }
        function fullscreenVideo() {
            const videoPlayer = document.getElementById('video-player');
            if (videoPlayer.requestFullscreen) {
                videoPlayer.requestFullscreen();
            } else if (videoPlayer.webkitRequestFullscreen) {
                videoPlayer.webkitRequestFullscreen();
            } else if (videoPlayer.msRequestFullscreen) {
                videoPlayer.msRequestFullscreen();
            }
        }
    </script>
</body>
</html>`;
    res.send(html);
});

// Route pour servir le CSS
app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

// Route pour obtenir la liste des films
app.get('/films', (req, res) => {
    const films = getFilms();
    res.json(films);
});

// Route pour servir un film spécifique
app.get('/play', (req, res) => {
    const videoPathParam = req.query.path;
    if (!videoPathParam) {
        return res.status(400).send('Paramètre path manquant');
    }
    const videoPath = path.join(FILMS_DIR, decodeURIComponent(videoPathParam));
    if (!fs.existsSync(videoPath)) {
        return res.status(404).send('Film non trouvé');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

app.listen(3000, () => {
    console.log("Serveur lancé sur le port 3000");
});
