const fs = require("fs");
const puppeteer = require("puppeteer");
const axios = require("axios");
const path = require("path");
const https = require("https");

const HEADLESS = true;

// Set your chrome executable path here v
const CHROME_PATH = "/usr/bin/google-chrome"

const ENDPOINT = "https://gounlimited.to/api/file/list";

const SAVE_PATH = "videos/";

fs.mkdirSync(SAVE_PATH, { recursive: true });

let SKIP = 0;

if (process.argv.length >= 4) {
  SKIP = parseInt(process.argv[3]);
}

if (process.argv.length < 3) {
  console.log("node . [json-file]")
  process.exit(1);
}

const API_KEY = process.argv[2];

async function getGoVideos() {
  return new Promise(async (resolve, reject) => {
    try {
      const links = [];

      let page = 1;

      let res = await axios.get(ENDPOINT, {
        params: {
          key: API_KEY,
          per_page: 1000,
          page: page++
        }
      });

      links.push(...res.data.result.files);

      while (links.length < parseInt(res.data.result.results_total)) {
        res = await axios.get(ENDPOINT, {
          params: {
            key: API_KEY,
            per_page: 1000,
            page: page++
          }
        });

        links.push(...res.data.result.files);
      }

      resolve(links);
    }
    catch (err) {
      reject(err)
    }
  })
}

function embedLink(video) {
  return `https://gounlimited.to/embed-${video.file_code}.html`;
}

(async () => {
  console.log("Starting chrome...");

  let browser = await puppeteer.launch({
    headless: HEADLESS,
    executablePath: CHROME_PATH
  });

  function download(video) {
    return new Promise(async (resolve, reject) => {
      try {
        const page = await browser.newPage();

        await page.goto(embedLink(video), { waitUntil: "domcontentloaded" });

        let source = null;

        source = await page.evaluate(() => {
          let videos = document.getElementsByTagName("video");
          videos = Array.from(videos);
          return videos[0].src;
        })

        if (source.includes('fs33')) {
          console.log("Skipping (broken link)...");
          return resolve();
        }

        await page.goto(source);

        const filename = `${video.title} - ${video.file_code}.mp4`;

        let lastPercent = 0;

        require('download-file-with-progressbar')(source, {
          filename,
          dir: SAVE_PATH,
          onDone: () => {
            console.log(`Downloaded to ${filename}.`);
            resolve();
          },
          onError: (err) => {
            reject(err);
          },
          onProgress: (curr, total) => {
            const percent = parseFloat((curr / total * 100).toFixed(2));
            if (percent - lastPercent >= 0.25) {
              console.log(`Downloading: ${percent}%`);
              lastPercent = percent;
            }
          }
        });
      }
      catch (err) {
        console.error(err);
        reject(err);
      }
    })
  }

  let videos = await getGoVideos();

  if (SKIP > 0) {
    console.log(`Skipping ${SKIP} videos...`);
  }

  for (let i = SKIP; i < videos.length; i++) {
    const video = videos[i];
    console.log(`(${i + 1}/${videos.length}) Downloading ${video.title}...`);

    let downloaded = false;
    while (!downloaded) {
      try {
        await download(video);
        downloaded = true;
      }
      catch (err) {
        console.log("Trying again...");
      }
    }
  }

  process.exit(0);
})();