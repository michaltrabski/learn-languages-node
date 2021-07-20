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
const _ = require("lodash");

const write = (filePath, data) => {
  fs.writeFileSync(path.resolve(__dirname, filePath), JSON.stringify(data));
};

const read = (filePath) => {
  const data = fs.readFileSync(filePath, {
    encoding: "utf8",
  });
  return JSON.parse(data);
};

const wait = (t) => {
  t = 1000;
  return new Promise((r) => setTimeout(() => r(t), t));
};

const makeVoiceover = async (conf) => {
  const filenames = fs.readdirSync(path.resolve(__dirname, "mp3"));
  console.log(filenames);
  // if (!conf.browser) await login(conf);
  // await getAudio(conf, "What is This?");
};

const getAudio = async (conf, _text) => {
  const text = conf.prefix + _text + conf.suffix;

  const { page } = conf;
  await wait(5000);
  // 1 Type and generate audio
  const input = await page.$("#tts-tarea");
  await input.click({ clickCount: 3 });
  await page.type("#tts-tarea", text);
  await page.click("#ttsGenerateBtn");

  // 2 Click away popup: Your Voice Over has been created!
  console.log(1);
  await wait(5000);
  console.log(2);
  try {
    await page.click(".swal2-confirm");
  } catch (err) {
    console.log(2222222);
  }

  console.log(3);
  await wait(5000);
  // 3 get link of first recording
  let html = await page.evaluate(() => document.body.innerHTML);
  let $ = cheerio.load(html);
  const link = $("#blastered_datatable [data-link]").attr("data-link");
  const textContent = $("#blastered_datatable .minwidth").text();
  console.log(4, link, textContent);

  await download(link, "mp3");
  const mp3Name = link.split("/").pop();
  const newMp3Name =
    slug(text.replace(conf.prefix, "").replace(conf.suffix, "")) + ".mp3";

  await wait(5000);
  console.log(5, mp3Name, newMp3Name);
  fs.renameSync(
    path.resolve(__dirname, "mp3", mp3Name),
    path.resolve(__dirname, "mp3", newMp3Name)
  );

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

const login = async (conf) => {
  const browser = await puppeteer.launch({
    headless: conf.headless,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto(conf.loginPage);
  await page.type("#loginemail", conf.email);
  await page.type("#loginpassword", conf.password);

  const [response1] = await Promise.all([
    page.waitForNavigation(),
    page.click("#login_button"),
  ]);
  console.log("Logging...");
  await page.goto(conf.appPage);
  console.log("Logged in Success!");
  // bootstrap-switch-handle-off

  // DISMISS POPUP
  console.log("Try to click away popup");
  await wait(5000);
  await page.waitForSelector(".bootbox-close-button");
  await page.click(".bootbox-close-button");

  console.log("Speachello ready!");

  // await browser.close();
  conf.browser = browser;
  conf.page = page;
  return "SUCCESS";
};

const createJsonFileForEachWord = async (conf, _words) => {
  const words = [];
  _words.forEach((w) => {
    words.push(w.word);
    w.examples.forEach((e) => {
      let sArr = e.sentence.split(" ");
      sArr.forEach((s) => {
        s = s.replace(/\./g, "");
        s = s.replace(/\?/g, "");
        s = s.replace(/\!/g, "");

        words.push(s.toLowerCase());
      });
    });
  });

  // uniq
  const uniqWords = _.uniqBy(words, (w) => w);
  // console.log(1, words, uniqWords);

  for (word of uniqWords) {
    const translation = await translate(conf, word);

    const data = {
      type: "word",
      slug: slug(word),
      mp3: null,
      source_lang: conf.source_lang,
      content: word,
      [conf.target_lang]: translation,
    };

    write(`mp3/${slug(word)}.json`, data);
  }
};

const createJsonFileForEachExample = async (conf, words) => {
  const examples = [];
  words.forEach((i) => i.examples.forEach((s) => examples.push(s)));

  // examples will be uniq anyway
  const uniqExamples = _.uniqBy(examples, (e) => e.sentence);

  for (example of uniqExamples) {
    const { sentence } = example;
    const translation = await translate(conf, sentence);

    const words = sentence.split(" ");

    const wordsWithTranslations = await Promise.all(
      words.map(async (word) => {
        word = word.replace(/\./g, "");
        word = word.replace(/\?/g, "");
        word = word.replace(/\!/g, "");
        word = word.toLowerCase();

        const translation = await translate(conf, word);
        return { word, [conf.target_lang]: translation };
      })
    );

    // console.log(1, words, wordsWithTranslations);

    const data = {
      type: "sentence",
      slug: slug(sentence),
      mp3: null,
      source_lang: conf.source_lang,
      content: sentence,
      [conf.target_lang]: translation,
      words: wordsWithTranslations,
    };

    write(`mp3/${slug(sentence)}.json`, data);
  }
};

counter = 0;
const translate = async (conf, text) => {
  counter++;
  // console.log(counter, text);
  const auth_key = process.env.DEEPL_API_KEY;
  return new Promise((resolve, reject) => {
    const textSlug = slug(text);
    const translationFileName = `deepl_${conf.source_lang}_${conf.target_lang}`;
    const find = conf[translationFileName][textSlug];

    if (find) {
      console.log("translation found in file");
      resolve(find);
      return;
    }

    if (!conf.useDeepl) {
      console.log("deepl has to be activated");
      resolve("deepl has to be activated");
      return;
    }

    // call to deepl
    deepl({
      source_lang: conf.source_lang,
      free_api: true,
      text,
      target_lang: conf.target_lang,
      auth_key,
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
      .catch((err) => reject(err, "translate deepl Error"))
      .finally(() => console.log("deepl call has been made!!!"));
  });
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

const readAllJsonFromMp3Folder = () => {
  const filenames = fs.readdirSync(path.resolve(__dirname, "mp3"));
  const filenamesFiltered = filenames.filter((f) => f.includes(".json"));

  return filenamesFiltered;
};

const createFolder = (folderName) => {
  if (!fs.existsSync(folderName)) fs.mkdirSync(folderName);
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
  createJsonFileForEachWord,
  makeDeeplTranslation,
  write,
  read,
  makeVoiceover,
};
