require("dotenv").config();
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const https = require("https");
const fs = require("fs");
const slugify = require("slugify");
const download = require("download");
const {
  wait,
  slug,
  getAudio,
  getAllMp3,
  translate,
  createFolder,
  readAllJsonFromMp3Folder,
} = require("./utils");
const path = require("path");
const axios = require("axios");
const { makeWordsList } = require("./words");

const source_lang = "EN";
const target_lang = "PL";

(async () => {
  createFolder("mp3");
  const { normalizedText, words, sentences } = await makeWordsList();
  // console.log("words => ", words.length);
  const result = createJsonFileForEachExample(words.slice(0, 3));
  // console.log(result);

  createFolder("translations");
  createFolder("translations/EN-PL");
  createFolder("translations/EN-PLsssssssss");
  const allJsonFiles = readAllJsonFromMp3Folder();
  console.log("allJsonFiles", allJsonFiles);
})();

const createJsonFileForEachExample = (_words) => {
  const words = [..._words];
  const examplesFromWords = [];
  words.forEach((i) => i.examples.forEach((s) => examplesFromWords.push(s)));
  for (exmpl of examplesFromWords) {
    fs.writeFileSync(
      path.resolve(__dirname, "mp3", `${slug(exmpl)}.json`),
      JSON.stringify({
        slug: slug(exmpl),
        source_lang,
        content: exmpl,
        translations: { PL: "Tu będzie translacja" },
        words: exmpl.split(" "),
      })
    );
  }
  return "createJsonFileForEachExample DONE";
};

(async () => {
  return;
  const allMp3 = await getAllMp3();

  const browser = await puppeteer.launch({
    headless: true, //false,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto(process.env.REACT_APP_URL);
  await wait(1000);
  let html = await page.evaluate(() => document.body.innerHTML);

  // console.log(html);
  let $ = cheerio.load(html);

  const limit = 2;
  let counter = 0;

  $("[data-mp3]").each(function () {
    (async () => {
      counter++;
      if (counter > limit) return;
      const slug = $(this).attr("data-mp3");
      const mp3FileName = slug + ".mp3";

      const content = $(this).text();

      const translations = {};
      const translation = await translate({
        text: content,
        source_lang,
        target_lang,
      });
      translations[target_lang] = translation;

      const words = content.split(" ").map((word) => ({ word }));
      for (let item of words) {
        // console.log(item, item.word);
        const translation = await translate({
          text: item.word,
          source_lang,
          target_lang,
        });
        if (!item.translations) item.translations = {};
        item.translations[target_lang] = translation;
      }

      const data = {
        slug,
        mp3FileName,
        source_lang,
        content,
        translations,
        words,
      };

      fs.writeFile(
        path.resolve(__dirname, "mp3", `${slug}.json`),
        JSON.stringify(data),
        (err) => {
          if (err) return console.log(err);
          console.log("CREATED => ", slug);
        }
      );
    })();
  });
})();

const loginPage = process.env.LOGIN_PAGE_MP3_GENERATOR;
const appPage = process.env.APP_PAGE_MP3_GENERATOR;
const email = process.env.EMAIL_MP3_GENERATOR;
const password = process.env.EMAIL_MP3_PASSWORD;

const items = [
  "If you need to download mp3 file, just choose the size od get it for free.",
  "Dillon asked in an accusing tone.",
  "If hi need to download mp3 file, just choose the size od get it for free.",
  "Roy asked in an accusing tone.",
];

const login = async (run) => {
  if (!run) return;

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto(loginPage);
  await page.type("#loginemail", email);
  await page.type("#loginpassword", password);

  const [response1] = await Promise.all([
    page.waitForNavigation(),
    page.click("#login_button"),
  ]);
  console.log("Logging...");
  await page.goto(appPage);
  console.log("Logged in Success!");
  // bootstrap-switch-handle-off

  // DISMISS POPUP
  console.log("Try to click away popup");
  await wait(5000);
  await page.waitForSelector(".bootbox-close-button");
  await page.click(".bootbox-close-button");

  for (let item of items) await getAudio(page, item);

  await browser.close();
};

// (() => {
//   const run = true;
//   try {
//     login(run);
//   } catch (err) {
//     console.log("err xxxxxxxxxxxxxxxxxxxxxxx");
//     login(run);
//   }
// })();
