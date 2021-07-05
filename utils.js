const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const https = require("https");
const fs = require("fs");
const slugify = require("slugify");
const download = require("download");
const path = require("path");
const deepl = require("deepl");
const { resolve } = require("path");

const translate = async (text) => {
  const auth_key = "1ad2cee4-217c-8df0-a930-a0e29fd4fd4e:fx";
  // console.log("xxxxxxxxxx", text);
  return new Promise((resolve, reject) => {
    deepl({
      source_lang: "EN",
      free_api: true,
      text,
      target_lang: "PL",
      auth_key,
      // All optional parameters available in the official documentation can be defined here as well.
    })
      .then((res) => {
        const { translations } = res.data;

        resolve(translations[0].text);
      })
      .catch((err) => reject("translate deepl Error"));
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

const wait = (t) => new Promise((r) => setTimeout(() => r(), t));

const slug = (text) => {
  slugify(text, {
    replacement: "-", // replace spaces with replacement character, defaults to `-`
    remove: /[*+~.?!,()'"!:@]/g, // remove characters that match regex, defaults to `undefined`
    lower: true, // convert to lower case, defaults to `false`
    strict: false, // strip special characters except replacement, defaults to `false`
    locale: "vi", // language code of the locale to use
  });
};

module.exports = { wait, slug, getAudio, getAllMp3, translate };
