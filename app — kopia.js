const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const https = require("https");
const fs = require("fs");
const slugify = require("slugify");

const loginPage = "https://app.blasteronline.com/user/login";
const appPage = "https://app.blasteronline.com/speechelo/";

const email = "michal.trabski@gmail.com";
const password = "C56mhgikoccoc";

const wait = (time = 1000) =>
  new Promise((resolve, reject) => {
    setTimeout(() => resolve(), time);
  });

const app = async () => {
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
  console.log("Try to click away popup");
  await wait(5000);
  await page.waitForSelector(".bootbox-close-button");
  await page.click(".bootbox-close-button");
  console.log("Logged in Success!");

  const items = [
    "Dillon asked in an accusing tone.",
    "   Why did you follow me anyway.",
    "He snapped back.",
    "  He looked around stunned.",
    "  Way to go dil.",
    " He knew he couldn’t dismiss this.",
    "  No, he realized.",
    "  Dillon smiled back and nodded.",
    "You know what, dillon.",
  ];
  try {
    for (let item of items) {
      await getAudio(page, item);
    }
  } catch (err) {
    console.log("err2", err);
  }

  // 1

  // await browser.close();
};

app();

const getAudio = async (page, text) => {
  const input = await page.$("#tts-tarea");
  await input.click({ clickCount: 3 });
  await page.type("#tts-tarea", text);
  await page.click("#ttsGenerateBtn");
  // await wait(5000);
  // await page.click(".swal2-confirm");
  // try {
  //   await page.waitForSelector(".swal2-confirm");
  //   await page.evaluate(() => {
  //     document.querySelector(".swal2-confirm").click();
  //   });
  // } catch (err) {}
  await page.reload();
  console.log("Audio taken Success: ", text);

  const html = await page.evaluate(() => document.body.innerHTML);
  const $ = cheerio.load(html);

  // console.log("html", html);
  const link = $("#blastered_datatable [data-link]").attr("data-link");

  // console.log("link", link);
  // await page.goto(link);
  await download(link, text);
  await page.reload();
  // delete created voicover
  await wait(9000);
  await page.waitForSelector("#blastered_datatable thead .columswitch");
  await page.evaluate(() => {
    document.querySelector("#blastered_datatable thead .columswitch").click();
  });
  await page.waitForSelector("#deleteSelectedBTN");
  await page.evaluate(() => {
    document.querySelector("#deleteSelectedBTN").click();
  });
  try {
    await page.waitForSelector(".swal2-confirm");
    await page.evaluate(() => {
      document.querySelector(".swal2-confirm").click();
    });
  } catch (err) {}

  // await page.reload();
};

const download = (link, text) =>
  new Promise((resolve, reject) => {
    https.get(link, (res) => {
      // Image will be stored at this path
      const path = `${__dirname}/mp3/${slug(text)}.mp3`;
      const filePath = fs.createWriteStream(path);
      res.pipe(filePath);
      filePath.on("finish", () => {
        filePath.close();
        console.log("Download Completed", slug(text));
        resolve("done");
      });
    });
  });

const slug = (text) =>
  slugify(text, {
    replacement: "-", // replace spaces with replacement character, defaults to `-`
    remove: /[*+~.?!,()'"!:@]/g, // remove characters that match regex, defaults to `undefined`
    lower: true, // convert to lower case, defaults to `false`
    strict: false, // strip special characters except replacement, defaults to `false`
    locale: "vi", // language code of the locale to use
  });
