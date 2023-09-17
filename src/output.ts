import { FlashCard } from "./chatgpt";
import { parse, stringify } from "csv/sync";

function createBack(flashCard: FlashCard) {
  let result = ``;
  if (flashCard.translation) {
    result += flashCard.translation + `\n`;
    result += `----------- \n`;
  }
  result += flashCard.definition + `\n`;
  result += `----------- \n`;
  flashCard.examples.forEach((example) => {
    result += example + `\n`;
  });
  return result;
}

function createFront(flashCard: FlashCard) {
  return flashCard.word + " " + `{${flashCard.wordClass}}`;
}

export function outputFlashCards(flashards: FlashCard[]) {
  const entries = flashards.map((fc) => [createFront(fc), createBack(fc)]);
  const outputCSV = stringify(entries, {
    bom: true,
  });
  console.log(outputCSV);
}
