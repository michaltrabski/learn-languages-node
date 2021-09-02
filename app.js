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
  createJsonFileForEachWord,
  makeDeeplTranslation,
  read,
  makeVoiceover,
} = require("./utils");
const path = require("path");
const axios = require("axios");
const { makeWordsList } = require("./words");
const { scrapper } = require("./scrapper");

const source_lang = "EN";
const target_lang = "PL";

const conf = {
  createVoiceover: true,
  useDeepl: true,
  headless: true,
  browser: null,
  page: null,
  prefix: "[startSpeech r=Slow startSpeech][startSpeech v=X-Loud startSpeech]",
  suffix: "[endSpeech][endSpeech][sPause sec=1 ePause]",
  loginPage: process.env.LOGIN_PAGE_MP3_GENERATOR,
  appPage: process.env.APP_PAGE_MP3_GENERATOR,
  email: process.env.EMAIL_MP3_GENERATOR,
  password: process.env.EMAIL_MP3_PASSWORD,
  source_lang,
  target_lang,
  textSource: "text.txt", // "longText1.txt";
  splitter: "XYFNKW",
  examplexPerWord: 4,
  wordsPerPage: 5,
  howManyPages: 3,
  rowTextLenght: 100100100,
  sentenceLenghtMin: 15,
  sentenceLenghtMax: 50,
  [`deepl_${source_lang}_${target_lang}`]: read(
    `translations/deepl_${source_lang}_${target_lang}.json`
  ),
};

const start = async () => {
  try {
    console.log("START");

    // const text = "swim";
    // const translationsArray = await scrapper(text);
    // console.log(text, translationsArray);

    const { words } = await makeWordsList(conf);
    // console.log(1, words);
    const voicesArray1 = await createJsonFileForEachExample(conf, words);
    const voicesArray2 = await createJsonFileForEachWord(conf, words);
    await makeVoiceover(conf, [...voicesArray1, ...voicesArray2]);
    if (conf.browser) conf.browser.close();

    console.log("DONE");
  } catch (err) {
    console.log("START FAILED... Trying to START AGAIN!!!", err);
    if (conf.browser) await conf.browser.close();
    conf.browser = null;
    conf.page = null;
    start();
  }
};

start();

// const addTranslationsToContent = (allJsonFiles) => {
//   const _file = `translations/deepl-${conf.source_lang}-${conf.target_lang}.json`;
//   const deeplTranslationStr = fs.readFileSync(_file, {
//     encoding: "utf8",
//   });
//   const deeplTranslation = JSON.parse(deeplTranslationStr);
//   // console.log(deeplTranslation);

//   const files = [...allJsonFiles];
//   files.forEach((fileName) => {
//     const file = `mp3/${fileName}`;
//     const str = fs.readFileSync(file, {
//       encoding: "utf8",
//     });
//     const data = JSON.parse(str);
//     if (data.type !== "sentence") return;
//     // console.log(1, data, data[target_lang], deeplTranslation[data.slug]);
//     data[conf.target_lang] = deeplTranslation[data.slug];
//     fs.writeFileSync(file, JSON.stringify(data));
//   });
// };

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

// const items = [
//   "If you need to download mp3 file, just choose the size od get it for free.",
//   "Dillon asked in an accusing tone.",
//   "If hi need to download mp3 file, just choose the size od get it for free.",
//   "Roy asked in an accusing tone.",
// ];

// (() => {
//   const run = true;
//   try {
//     login(run);
//   } catch (err) {
//     console.log("err xxxxxxxxxxxxxxxxxxxxxxx");
//     login(run);
//   }
// })();
