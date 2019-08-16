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

const HEADLESS = true;

// Set your chrome executable path here v
const CHROME_PATH = "/usr/bin/google-chrome"

const ENDPOINT = "https://gounlimited.to/api/file/list";

let SKIP = 0;

if (process.argv.length < 3) {
	console.log("PLEASE PROVIDE API KEY: node . your_api_key");
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

	function test(url) {
		return new Promise(async (resolve, reject) => {
			try {
				const page = await browser.newPage();

				await page.goto(url);

				let source = null;

				source = await page.evaluate(() => {
					let videos = document.getElementsByTagName("video");
					videos = Array.from(videos);
					return videos[0].src;
				})

				console.log(source);

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

	let sources = [];

	for (let i = SKIP; i < videos.length; i++) {
		const video = videos[i];

		console.log(`(${i + 1}/${videos.length}) Testing ${video.title}...`);

		let gotLink = false;

		while (!gotLink) {
			try {
				const url = await test(video.link);
				sources.push({
					title: video.title,
					link: video.link,
					cdnLink: url,
					id: video.file_code
				});
				gotLink = true;
			}
			catch (err) {
				console.error(err);
			}
		}
	}

	console.log(`Writing all ${sources.length} CDN links to file (cdn.json)...`);
	fs.writeFileSync("cdn.json", JSON.stringify(sources));

	let broken = sources.filter(i => i.cdnLink.includes("fs33"));
	console.log(`Writing all ${broken.length} broken files to file (broken.json)...`);
	fs.writeFileSync("broken.json", JSON.stringify(broken));
	process.exit(0);
})();