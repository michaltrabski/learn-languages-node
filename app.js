require("dotenv").config();
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const https = require("https");
const fs = require("fs");
const slugify = require("slugify");
const download = require("download");
const _ = require("lodash");
const {
  wait,
  slug,
  getAudio,
  getAllMp3,
  translate,
  createFolder,
  readAllJsonFromMp3Folder,
  createJsonFileForEachExample,
  makeDeeplTranslation,
  read,
} = require("./utils");
const path = require("path");
const axios = require("axios");
const { makeWordsList } = require("./words");

const conf = {
  source_lang: "EN",
  target_lang: "PL",
  textSource: "largeText.txt", // "longText1.txt";
  splitter: "XYFNKW",
  examplexPerWord: 1,
  wordsPerPage: 5,
  howManyPages: 1,
  rowTextLenght: 100100, //333444; //900090009;
  sentenceLenghtMin: 35,
  sentenceLenghtMax: 50,
  deepl_EN_PL: read("translations/deepl_EN_PL.json"),
};

(async () => {
  const { words } = await makeWordsList(conf);
  // console.log(0, words);
  createJsonFileForEachExample(words);
  // // console.log(result);
  // console.log(55555555555555, conf);

  // const allJsonFiles = readAllJsonFromMp3Folder();
  // // console.log("allJsonFiles =>", allJsonFiles);

  // await makeDeeplTranslation(allJsonFiles);
  // addTranslationsToContent(allJsonFiles);
})();

const addTranslationsToContent = (allJsonFiles) => {
  const _file = `translations/deepl-${conf.source_lang}-${conf.target_lang}.json`;
  const deeplTranslationStr = fs.readFileSync(_file, {
    encoding: "utf8",
  });
  const deeplTranslation = JSON.parse(deeplTranslationStr);
  // console.log(deeplTranslation);

  const files = [...allJsonFiles];
  files.forEach((fileName) => {
    const file = `mp3/${fileName}`;
    const str = fs.readFileSync(file, {
      encoding: "utf8",
    });
    const data = JSON.parse(str);
    if (data.type !== "sentence") return;
    // console.log(1, data, data[target_lang], deeplTranslation[data.slug]);
    data[conf.target_lang] = deeplTranslation[data.slug];
    fs.writeFileSync(file, JSON.stringify(data));
  });
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
