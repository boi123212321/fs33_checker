/*
  GOUnlimited Fs33 checker
	by github.com/boi123212321

	Install:
	Install Google Chrome
	Install Node.js (https://nodejs.org/en/)
	In directory, run "npm install"

	Run:
	In directory, run "node . [your-api-key]"
*/


const fs = require("fs");
const puppeteer = require("puppeteer");
const axios = require("axios");
const PromisePool = require("async-promise-pool");

const HEADLESS = true;

// Set your chrome executable path here v
const CHROME_PATH = "/usr/bin/google-chrome"
const CONCURRENCY = 1;
const ENDPOINT = "https://gounlimited.to/api/file/list";

let SKIP = 0;

if (process.argv.length < 3) {
  console.log("PLEASE PROVIDE API KEY: node . your_api_key skip?");
  process.exit(0);
}

if (process.argv.length >= 4) {
  SKIP = parseInt(process.argv[3]);
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

(async () => {
  console.log("Starting chrome...");

  let browser = await puppeteer.launch({
    headless: HEADLESS,
    executablePath: CHROME_PATH
  });

  function test(url, title) {
    return new Promise(async (resolve, reject) => {
      try {
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: "domcontentloaded" });

        let source = null;

        source = await page.evaluate(() => {
          let videos = document.getElementsByTagName("video");
          videos = Array.from(videos);
          let head = videos[0];

          if (head)
            return head.src;
          return null;
        })

        if (source == null) {
          console.log(`Could not get source link for ${url} (no video player?/corrupt file?)...`);
        }
        else
          console.log(`${title}: ${source}`);

        await page.close();

        resolve(source);
      }
      catch (err) {
        reject(err);
      }
    })
  }

  let videos = await getGoVideos();

  if (SKIP > 0) {
    console.log(`Skipping ${SKIP} videos...`);
  }

  console.log(`Concurrency: ${CONCURRENCY}`);

  let sources = [];

  if (fs.existsSync("cdn.json")) {
    sources.push(...JSON.parse(fs.readFileSync("cdn.json")));
    console.log(`Read ${sources.length} from file.`);
  }

  const pool = new PromisePool({ concurrency: CONCURRENCY });

  for (let i = SKIP; i < videos.length; i++) {
    pool.add(() => {
      return new Promise(async (resolve, reject) => {
        const video = videos[i];

        console.log(`(${i + 1}/${videos.length}) Testing ${video.title}...`);

        let gotLink = false;

        while (!gotLink) {
          try {
            const url = await test(video.link, video.title);

            if (url) {
              sources.push({
                title: video.title,
                link: video.link,
                cdnLink: url,
                id: video.file_code
              });

              fs.writeFileSync("cdn.json", JSON.stringify(sources));
              let broken = sources.filter(i => i.cdnLink.includes("fs33"));
              fs.writeFileSync("broken.json", JSON.stringify(broken));
            }

            gotLink = true;
            resolve();
          }
          catch (err) {
            console.error(err);
          }
        }
      });
    });
  }

  await pool.all();

  console.log(`Done. Wrote all ${sources.length} CDN links to file (cdn.json)...`);
  console.log(`Wrote all ${broken.length} broken files to file (broken.json)...`);

  process.exit(0);
})();
