import {
	OpenDialogOptions,
	Uri,
	window
} from "vscode";

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

export function capitalizeFirstLetter(newString: string): string {
	return newString.charAt(0).toUpperCase() + newString.slice(1);
}
