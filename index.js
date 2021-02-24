const Koa = require("koa");
const app = new Koa();
const PORT = 5000;
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const render = require("koa-ejs");
const ExcelJS = require("exceljs");

render(app, {
  root: path.join(__dirname),
  layout: false,
  cache: false,
});

const rootPath = path.resolve(__dirname);

function writeFile(data, filename) {
  fs.writeFile(`${rootPath}/${filename}`, JSON.stringify(data), (err) => {
    if (err) return console.log(err);
    console.log("Finished");
  });
}

async function writeExcel(data, columns) {
  const workbook = new ExcelJS.Workbook();
  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 10000,
      height: 20000,
      firstSheet: 0,
      activeTab: 1,
      visibility: "visible",
    },
  ];
  const sheet = workbook.addWorksheet("My Sheet");
  sheet.columns = columns;
  sheet.addRows(data);
  await workbook.xlsx.writeFile(`${rootPath}/crawler.xlsx`);
}

async function login(page) {
  await page.goto("https://test.ssc.hrtps.com/admin/#/");
  // await page.waitForSelector(`[class*="Login_mailInput"]`);
  await page.type(
    `[class*="Login_mailInput"]:nth-of-type(1) input`,
    "demo001@hrtps.com"
  );
  await page.type(`[class*="Login_mailInput"]:nth-of-type(2) input`, "123456");
  await page.click(`[class*="Login"] button`);
}

async function gap(page, time = 1000) {
  await page.waitForTimeout(time);
}

async function staffDetector(page) {
  return new Promise(async (resolve) => {
    let total = null;
    let result = [];
    page.on("response", async (response) => {
      const url = response.url();
      const ok = response.ok();
      if (ok && url.indexOf("/api/staff/list") > -1) {
        const json = await response.json();
        total = json.result.total;
        list = json.result.list;
        result = [...result, ...list];

        if (result.length >= total) {
          const d = new Date();
          const date = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
          writeFile(result, `${date}.test.json`);
          resolve(result);
        } else {
          await page.waitForTimeout(1000);
          await page.click('[class*="ant-pagination-next"]');
        }
      }
    });
    // go staff page
    await page.goto(
      "https://test.ssc.hrtps.com/admin/#/peopleManage/orgs/staffdepart"
    );
  });
}

const crawlStaff = async () => {
  const browser = await puppeteer.launch({
    // headless: false,
    devtools: true,
    args: ["--enable-features=NetworkService"],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await login(page);
  await gap(page);
  const result = await staffDetector(page);
  const columns = [
    { header: "Id", key: "id" },
    { header: "姓名", key: "name" },
    { header: "手机", key: "phone_number" },
    { header: "部门", key: "department_name" },
  ];
  await writeExcel(result, columns);
  await browser.close();
  return result;
};

const upload = async (page) => {
  try {
    const triggerPath = "#basic > div:nth-of-type(1) .ant-upload";
    await page.goto("https://test.ssc.hrtps.com/admin/#/robot/setting/basic");

    await page.waitForResponse(
      (response) => response.url().indexOf("/api/bot/settings/list") > -1
    );

    await page.waitForSelector(triggerPath);
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser(),
      page.click("#basic > div:nth-of-type(1) .ant-upload"),
    ]);
    // await fileChooser.accept([`${rootPath}/avatar_git.gif`]);
    await fileChooser.accept([`${rootPath}/avatar.png`]);
    await gap(page, 2000);
    await page.click("[class^=basicSetting_submitBtn]");
  } catch (e) {
    console.log(e);
  }
};

const uploadFile = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ["--enable-features=NetworkService"],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await login(page);
  await gap(page);
  await upload(page);
};

const downloadFile = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    devtools: true,
    args: ["--enable-features=NetworkService"],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await login(page);
  await gap(page);
  await page.goto(
    "https://test.ssc.hrtps.com/admin/#/peopleManage/staff/staffIn-upload?type=2",
    {
      waitUntil: "networkidle0",
    }
  );
  await page.click("[class^=ant-btn]");
  await page._client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: rootPath,
  });
};

const screenshot = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--enable-features=NetworkService"],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080,
  });
  await login(page);
  await gap(page);
  await page.goto("https://test.ssc.hrtps.com/admin/#/datacenter/overview", {
    waitUntil: "networkidle0",
  });
  await page.screenshot({ fullPage: true, path: `${rootPath}/screenshot.png` });
};

const abortImg = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--enable-features=NetworkService",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080,
  });
  await page.setRequestInterception(true);
  page.on("request", (interceptedRequest) => {
    const url = interceptedRequest.url();
    if (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg")) {
      interceptedRequest.abort();
    } else {
      interceptedRequest.continue();
    }
  });
  await page.goto("https://www.hrtps.com/", {
    waitUntil: "networkidle0",
  });
};

const modifyRequest = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--enable-features=NetworkService",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080,
  });
  await page.setRequestInterception(true);
  page.on("request", (interceptedRequest) => {
    const url = interceptedRequest.url();
    if (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg")) {
      interceptedRequest.continue({
        url: "https://www.hrtps.com/static/media/banner.131888e4.png",
      });
    } else {
      interceptedRequest.continue();
    }
  });
  await page.goto("https://www.hrtps.com/", {
    waitUntil: "networkidle0",
  });
};

const screenshotInMobile = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--enable-features=NetworkService",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.goto("https://m.hrtps.com/", {
    waitUntil: "networkidle0",
  });
  await page.screenshot({
    fullPage: true,
    path: `${rootPath}/mobile.screenshot.png`,
  });
};

const tracing = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--enable-features=NetworkService",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();
  await page.tracing.start({ path: "trace.json" });
  await page.goto("https://www.google.com");
  await page.tracing.stop();
};

app.use(async (ctx) => {
  // ctx.body = fs.createReadStream(`${rootPath}/chart.html`);
  // ctx.body = "Hello World";
  // const res = await crawlStaff();
  // const fileName = '2021.1.26.test.json';
  // const res = fs.readFileSync(`${rootPath}/${fileName}`);
  // const templateData = res;
  // await ctx.render("chart", { data: templateData });
  // const fileName = '2021.1.26.test.json';
  // const json = fs.readFileSync(`${rootPath}/${fileName}`);
  // var xls = json2xls(json);
  // fs.writeFileSync(rootPath + "/data.xlsx", xls, "binary");
  // ctx.body = 'ok';
  const workbook = new ExcelJS.Workbook();
  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 10000,
      height: 20000,
      firstSheet: 0,
      activeTab: 1,
      visibility: "visible",
    },
  ];
  const sheet = workbook.addWorksheet("My Sheet");
  sheet.columns = [
    { header: "Id", key: "id" },
    { header: "Name", key: "name" },
    { header: "Phone", key: "phone_number" },
  ];
  const fileName = "2021.1.26.test.json";
  const json = fs.readFileSync(`${rootPath}/${fileName}`);
  JSON.parse(json).map((v) => sheet.addRow({ ...v }));
  await workbook.xlsx.writeFile(`${rootPath}/crawler.xlsx`);
});

async function getPerformance() {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--enable-features=NetworkService",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();
    await page.goto("https://hrtps.com/", {
      waitUntil: "networkidle0",
    });
    const renderTime = await page.evaluate(
      () =>
        window.performance.timing.domContentLoadedEventEnd -
        window.performance.timing.navigationStart
    );
    console.log("renderTime: ", renderTime);
    const detail = await page.metrics();
    console.log('detail: ', detail);
  } catch (e) {}
}

app.listen(PORT, async () => {
  // await crawlStaff();
  // await uploadFile();
  // await downloadFile();
  // await screenshot();
  // await abortImg();
  // await modifyRequest();
  await getPerformance();
  console.log(`App is listened on http://localhost:${PORT}`);
});
