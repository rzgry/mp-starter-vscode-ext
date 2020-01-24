import * as vscode from "vscode";
import {
	OpenDialogOptions,
	Uri,
	window
} from "vscode";

const properties = require("../properties");

export async function openDialogForFolder(customOptions: OpenDialogOptions): Promise<Uri | undefined> {
	const options: OpenDialogOptions = {
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
	};
	const result = await window.showOpenDialog(Object.assign(options, customOptions));

	if (result && result.length > 0) {
		return result[0];
	}

	return undefined;
}

export async function mapToPropertiesFile(arrayName: string, originalArray: string[]) {
	let mappedArray: string[] = [];
	mappedArray = originalArray.map(function (elem) {
		return properties[arrayName][elem];
	});
	mappedArray.sort().reverse();
	return mappedArray;
}

function capitalizeFirstLetter(newString: string) {
	return newString.charAt(0).toUpperCase() + newString.slice(1);
}

export async function mapToDescription(prevArray: string[], descriptions: Record<string, any>) {
	const specItems: vscode.QuickPickItem[] = [];
	prevArray.forEach(element => {
		const content = descriptions[element as keyof typeof descriptions];
		const contentStr = new String(content);

		const splits = contentStr.split(" - ");
		specItems.push({
			"label": splits[0],
			// 'detail': capitalizeFirstLetter(splits[1])
			"detail": splits[1]
		});
	});
	return specItems;
}

export function getKeyFromValue(value: Record<string, any>, arr: any) {
	return Object.keys(arr).find(key => arr[key] === value);
}


export async function resolveSpecs(specifications: string[], descriptions: Record<string, any>) {
	let dataString = "";
	if (specifications !== undefined && specifications.length > 0) {
		dataString += ', "selectedSpecs":[';
		specifications.forEach(async element => {
			let apiSpec;
			if (element === specifications[0]) {
				apiSpec = getKeyFromValue(element, descriptions);
				dataString = dataString + '"' + apiSpec + '"';
			} else {
				apiSpec = getKeyFromValue(element, descriptions);
				dataString += ', "' + apiSpec + '"';
			}
		});
		dataString = dataString + "]";
	}
	return dataString;
}
