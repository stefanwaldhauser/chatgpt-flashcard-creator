import { parse } from "csv/sync";
import { CsvError as ParsingError } from "csv-parse";
import _ from "lodash";

async function readStdIn(): Promise<string> {
  let result = "";
  const { stdin } = process;
  for await (const chunk of stdin) {
    result += chunk;
  }
  return result;
}

function stripNonAlphanumericFromStartAndEnd(input: string): string {
  const regex = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
  return input.replace(regex, "");
}

export async function getWordList(): Promise<string[]> {
  const data = await readStdIn();

  type parsedRecord = {
    word: string;
  };

  try {
    const records = parse(data, {
      encoding: "utf8",
      bom: true,
      trim: true,
      columns: ["word"],
    }) as parsedRecord[];

    return records
      .map((parsedRecord) => parsedRecord.word)
      .filter((word) => !_.isEmpty(word))
      .map((word) => stripNonAlphanumericFromStartAndEnd(word));
  } catch (err: unknown) {
    if (err instanceof ParsingError) {
      if (err.code === "CSV_RECORD_INCONSISTENT_COLUMNS") {
        console.error(
          "Error: The input csv needs to consist of a single column!",
        );
      }
    }
    throw err;
  }
}
