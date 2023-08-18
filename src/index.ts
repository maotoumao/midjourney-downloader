import JSZip from "jszip";
import { getUrlBlob, saveFile } from "./utils";

function checkIsMidjourneyBot(li?: Element | null) {
  if (!li) {
    return false;
  }
  const userName = li.querySelector(
    "h3[class^=header] span[class^=username]"
  )?.textContent;
  if (userName === "Midjourney Bot") {
    return true;
  }
  if (!userName) {
    return checkIsMidjourneyBot(li.previousElementSibling);
  }
}

function matchMidjourneyLis(li: Element) {
  if (checkIsMidjourneyBot(li)) {
    const id = li.id.substring(14);
    const prompts = Array.from(
      li.querySelector("div[id^=message-content-]>strong")?.childNodes ?? []
    )
      .map((node) => node.textContent)
      .join(" ");
    const url = li.querySelector<HTMLLinkElement>(
      "div[class^=messageAttachment] div[class^=imageWrapper] a[data-role=img]"
    )?.href;

    const isFourGrid =
      Array.from(li.querySelectorAll("button"))
        ?.map((_) => _.textContent)
        ?.join("") === "U1U2U3U4V1V2V3V4";

    if (!isFourGrid) {
      return {
        id,
        prompts,
        url,
      };
    }
  }
}

async function downloadAtOnce() {
  const contentList = document.querySelector('ol[class^="scrollerInner-"]');
  if (!contentList) {
    alert("请打开discord.com，并进入到newbie-*房间");
    return;
  }
  const lis = Array.from(contentList.children).filter(
    (item) => item.tagName === "LI"
  );
  const generatedData = lis
    .map(matchMidjourneyLis)
    .filter((_) => _?.id && _?.url);
  const zip = new JSZip();
  for (let i = 0; i < generatedData.length; ++i) {
    console.log("[PROCESSING] ", `${i + 1} / ${generatedData.length}`);
    const data = generatedData[i];
    if (!data) {
      continue;
    }

    const fileName = data.url!.match(/^.+\/(.+?)\.png.*$/)?.[1];
    const binaryBlob = await getUrlBlob(data.url!);
    if (binaryBlob && fileName) {
      zip?.file(`${fileName}.png`, binaryBlob, {
        binary: true,
      });
      zip?.file(`${fileName}.meta.json`, JSON.stringify(data, undefined, 4));
    }
  }
  const zipContent = await zip.generateAsync({ type: "blob" });
  saveFile(zipContent, `midjourney-${Date.now()}.zip`);
}

// 2. dom有变化时，添加到bundle
let currentZip = new JSZip();
let zipCount = 0;
let zipBatch = new Set();
const flushThreshold = 80;
let mutationObserver: MutationObserver;

function parseLiNode(node) {
  const data = matchMidjourneyLis(node);
  if (data?.id && data.url) {
    const fileName = data.url!.match(/^.+\/(.+?)\.png.*$/)?.[1];
    if (fileName && !zipBatch.has(fileName)) {
      zipBatch.add(fileName);
      getUrlBlob(data.url!).then((binaryBlob) => {
        if (binaryBlob) {
          currentZip?.file(`${fileName}.png`, binaryBlob, {
            binary: true,
          });
          currentZip?.file(
            `${fileName}.meta.json`,
            JSON.stringify(data, undefined, 4)
          );
        }
        zipCount++;
        console.log(
          `[NEW ARTWORK] ${data.url}`,
          `[ZIP COUNT] ${zipCount} / ${flushThreshold}`
        );
        if (zipCount >= flushThreshold) {
          flush();
        }
      });
    }
  }
}

async function startObserve() {
  mutationObserver = new MutationObserver((records) => {
    records.forEach((record) => {
      const addNodes = record.addedNodes;
      if (
        record.type === "childList" &&
        addNodes?.length &&
        (record.target as Element).tagName === "OL"
      ) {
        addNodes.forEach((node) => {
          const li = node as HTMLElement;
          if (
            !(li.tagName === "LI" && li.id.startsWith("chat-messages-"))
          ) {
            return;
          }
          parseLiNode(li);
        });
      } else if (
        record.type === "attributes" &&
        record.attributeName === "class" &&
        (record.target as Element).tagName === "DIV" &&
        (record.target as Element).className.includes("imageWrapper")
      ) {
        let li: Element | null | undefined = record.target as Element;
        while (li?.tagName !== "LI" && li) {
          li = li.parentElement;
        }
        if (li) {
          parseLiNode(li);
        }
      }
    });
  });
  const contentList = document.querySelector('ol[class^="scrollerInner-"]');
  if (!contentList) {
    return;
  }
  mutationObserver.observe(contentList, {
    attributes: true,
    childList: true,
    subtree: true,
  });
}

// flush
async function flush() {
  if (zipCount) {
    const prevZip = currentZip;
    currentZip = new JSZip();
    zipCount = 0;
    zipBatch.clear();
    const zipContent = await prevZip.generateAsync({ type: "blob" });
    saveFile(zipContent, `midjourney-${Date.now()}.zip`);
  }
}

// @ts-ignore
window.flushDownload = flush;

downloadAtOnce();
startObserve();
