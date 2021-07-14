require("dotenv").config();
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const https = require("https");
const fs = require("fs");
const slugify = require("slugify");
const download = require("download");
const path = require("path");
const deepl = require("deepl");
const { resolve } = require("path");

const source_lang = "EN";
const target_lang = "PL";

const write = (filePath, data) => {
  fs.writeFileSync(path.resolve(__dirname, filePath), JSON.stringify(data));
};

const read = (filePath) => {
  const data = fs.readFileSync(filePath, {
    encoding: "utf8",
  });
  return JSON.parse(data);
};

const makeDeeplTranslation = async (allJsonFiles) => {
  createFolder("translations");
  const _file = `translations/deepl-${source_lang}-${target_lang}.json`;
  const str = fs.readFileSync(_file, {
    encoding: "utf8",
  });
  const translation = JSON.parse(str);
  // console.log(translation);

  const files = [...allJsonFiles];
  files.forEach((fileName) => {
    const file = `mp3/${fileName}`;
    const data = JSON.parse(
      fs.readFileSync(file, {
        encoding: "utf8",
      })
    );
    const { type, slug, content } = data;

    if (type !== "sentence") return;
    if (translation[slug]) return; // There are translations allready

    (async () => {
      const deeplTranslation = await translate({
        text: content,
        source_lang,
        target_lang,
      }); // call for translations
      translation[slug] = deeplTranslation;
      data[target_lang] = deeplTranslation;
      fs.writeFileSync(_file, JSON.stringify(translation));
    })();
  });
};

const createJsonFileForEachExample = (_words) => {
  // console.log(2, _words);

  const words = [..._words];

  const examplesFromWords = [];
  words.forEach((i) => i.examples.forEach((s) => examplesFromWords.push(s)));
  for (exmpl of examplesFromWords) {
    const { sentence } = exmpl;

    const data = {
      type: "sentence",
      slug: slug(sentence),
      source_lang,
      content: sentence,
      words: sentence.split(" "),
    };

    fs.writeFileSync(
      path.resolve(__dirname, "mp3", `${slug(sentence)}.json`),
      JSON.stringify(data)
    );
  }
};

const readAllJsonFromMp3Folder = () => {
  const filenames = fs.readdirSync(path.resolve(__dirname, "mp3"));
  const filenamesFiltered = filenames.filter((f) => f.includes(".json"));

  return filenamesFiltered;
};

const createFolder = (folderName) => {
  if (!fs.existsSync(folderName)) fs.mkdirSync(folderName);
};

const translate = async (conf, text) => {
  const auth_key = process.env.DEEPL_API_KEY;
  return new Promise((resolve, reject) => {
    const textSlug = slug(text);
    const translationFileName = `deepl_${source_lang}_${target_lang}`;
    const find = conf[translationFileName][textSlug];

    if (find) return resolve(find);

    console.log("deepl call has been made!!!");
    deepl({
      source_lang: conf.source_lang,
      free_api: true,
      text,
      target_lang: conf.target_lang,
      auth_key,
      // All optional parameters available in the official documentation can be defined here as well.
    })
      .then((res) => {
        const { translations } = res.data;
        const translation = translations[0].text;

        conf[translationFileName][textSlug] = translation;
        write(
          `translations/${translationFileName}.json`,
          conf[translationFileName]
        );
        resolve(translation);
      })
      .catch((err) => reject(err, "translate deepl Error"));
  });
};

const getAllMp3 = () => {
  return new Promise((res, rej) => {
    const folder = path.resolve(__dirname, "mp3");
    const mp3 = [];
    fs.readdir(folder, (err, files) => {
      if (err) rej("getAllMp3 err");
      files.forEach((file) => {
        if (file.includes(".mp3")) mp3.push(file);
      });
      res(mp3);
    });
  });
};

const getAudio = async (page, text) => {
  // 1 Type and generate audio
  const input = await page.$("#tts-tarea");
  await input.click({ clickCount: 3 });
  await page.type("#tts-tarea", text);
  await page.click("#ttsGenerateBtn");

  // 2 Click away popup: Your Voice Over has been created!
  await wait(5000);
  await page.click(".swal2-confirm");

  // 3 get link of first recording
  let html = await page.evaluate(() => document.body.innerHTML);
  let $ = cheerio.load(html);
  const link = $("#blastered_datatable [data-link]").attr("data-link");
  // await page.goto(link);
  await download(link, "mp3");
  // await download(link, text);
  await wait(5000);

  await page.waitForSelector("#blastered_datatable thead .columswitch");
  await page.evaluate(() => {
    document.querySelector("#blastered_datatable thead .columswitch").click();
  });

  await page.waitForSelector("#deleteSelectedBTN");
  await page.evaluate(() => {
    document.querySelector("#deleteSelectedBTN").click();
  });

  await wait(5000);
  await page.waitForSelector(".swal2-confirm");
  await page.evaluate(() => {
    document.querySelector(".swal2-confirm").click();
  });
  await wait(5000);
  await page.waitForSelector(".swal2-confirm");
  await page.evaluate(() => {
    document.querySelector(".swal2-confirm").click();
  });
  await wait(5000);
};

const wait = (t) => new Promise((r) => setTimeout(() => r(t), t));

const slug = (text) => {
  return slugify(text, {
    replacement: "-", // replace spaces with replacement character, defaults to `-`
    remove: /[/\\_*+~.?!,()'"!:@]/g, // remove characters that match regex, defaults to `undefined`
    lower: true, // convert to lower case, defaults to `false`
    strict: false, // strip special characters except replacement, defaults to `false`
    locale: "vi", // language code of the locale to use
  });
};

module.exports = {
  wait,
  slug,
  getAudio,
  getAllMp3,
  translate,
  createFolder,
  readAllJsonFromMp3Folder,
  createJsonFileForEachExample,
  makeDeeplTranslation,
  write,
  read,
};
