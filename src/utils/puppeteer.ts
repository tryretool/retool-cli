import {
  WorkflowTemplateType,
  workflowTemplate,
} from "../resources/workflowTemplate";
import { getCredentials } from "../utils/credentials";

const puppeteer = require("puppeteer");

declare global {
  interface Window {
    generateWorkflowFromTemplateData: any;
  }
}

// https://stackoverflow.com/a/61304202
export const waitTillHTMLRendered = async (page: any, timeout = 30000) => {
  const checkDurationMsecs = 1000;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 2;

  while (checkCounts++ <= maxChecks) {
    const html = await page.content();
    const currentHTMLSize = html.length;

    // Uncomment for debugging
    // const bodyHTMLSize = await page.evaluate(
    //   () => document.body.innerHTML.length
    // );
    // console.log(
    //   "last: ",
    //   lastHTMLSize,
    //   " <> curr: ",
    //   currentHTMLSize,
    //   " body html size: ",
    //   bodyHTMLSize
    // );

    if (lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize)
      countStableSizeIterations++;
    else countStableSizeIterations = 0; //reset the counter

    // Page rendered fully
    if (countStableSizeIterations >= minStableSizeIterations) {
      break;
    }

    lastHTMLSize = currentHTMLSize;
    await page.waitForTimeout(checkDurationMsecs);
  }
};

export const generateWorkflowMetadata = async (tableName: string) => {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }

  try {
    // Launch Puppeteer and navigate to subdomain.retool.com/workflows
    const browser = await puppeteer.launch({
      headless: "new",
      // Uncomment this line to see the browser in action
      // headless: false,
    });
    const page = await browser.newPage();
    const cookies = [
      {
        domain: credentials.domain,
        name: "accessToken",
        value: credentials.accessToken,
      },
      {
        domain: credentials.domain,
        name: "xsrfToken",
        value: credentials.xsrf,
      },
    ];
    await page.setCookie(...cookies);
    await page.goto(`https://${credentials.domain}/workflows`);
    await waitTillHTMLRendered(page);

    // Call window.generateWorkflowFromTemplateData() on the page
    const generatedWorkflowMetadata = await page.evaluate(
      (
        tableName: string,
        workflowTemplate: WorkflowTemplateType,
        retoolDBUuid: string
      ) => {
        // Replaces instances of "name_placeholder" with the newly created table name
        workflowTemplate.map((item) => {
          if (item.pluginTemplate.template.tableName === "name_placeholder") {
            item.pluginTemplate.template.tableName = tableName;
          }
          if (item.pluginTemplate.template.query.includes("name_placeholder")) {
            item.pluginTemplate.template.query =
              item.pluginTemplate.template.query.replace(
                "name_placeholder",
                tableName
              );
          }

          // Inject retool DB UUID
          if (
            item.block.pluginId === "createQuery" ||
            item.block.pluginId === "readQuery" ||
            item.block.pluginId === "updateQuery" ||
            item.block.pluginId === "destroyQuery"
          ) {
            item.block.resourceName = retoolDBUuid;
            item.pluginTemplate.resourceName = retoolDBUuid;
          }
        });

        const payload = {
          name: `${tableName} CRUD Workflow`,
          templateData: workflowTemplate,
          resources: [],
        };

        const workflow = window.generateWorkflowFromTemplateData(payload);
        return workflow;
      },
      tableName,
      workflowTemplate,
      credentials.retoolDBUuid
    );

    await browser.close();
    return generatedWorkflowMetadata;
  } catch (error) {
    console.error("Error:", error);
  }
};
