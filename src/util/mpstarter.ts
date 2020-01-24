import * as vscode from "vscode";
import * as rp from "request-promise";
import * as request from "request";
import * as fs from "fs";
import { openDialogForFolder } from "./util";
import * as extract from "extract-zip";

async function askForGroupID(): Promise<string | undefined> {
  return await vscode.window.showInputBox({
    placeHolder: "e.g. com.example",
    prompt: "Specify a Group Id for your project.",
    value: "com.example",
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (value.trim().length === 0) {
        return "Group Id is required";
      }
      if (value.indexOf(" ") >= 0) {
        return "Group Id cannot contain a blank space";
      }
      return null;
    },
  });
}

async function askForArtifactID(): Promise<string | undefined> {
  return await vscode.window.showInputBox({
    placeHolder: "demo",
    prompt: "Specify an Artifact Id for your project.",
    value: "demo",
    ignoreFocusOut: true,
    validateInput: (value: string) => {
      if (value.trim().length === 0) {
        return "Artifact Id is required";
      }
      if (value.indexOf(" ") >= 0) {
        return "Artifact Id cannot contain a blank space";
      }
      return null;
    },
  });
}


async function askForJavaSEVersion(): Promise<string | undefined> {
  const SUPPORTED_JAVA_SE_VERSIONS = ["SE8"];

  return await vscode.window.showQuickPick(
    SUPPORTED_JAVA_SE_VERSIONS,
    { ignoreFocusOut: true, placeHolder: "Select a Java SE version." },
  );
}

async function askForMPVersion(mpVersions: string[]): Promise<string | undefined> {
  const MP_VERSION_LABELS: Record<string, string> = {
    MP32: "Version 3.2",
    MP30: "Version 3.0",
    MP22: "Version 2.2",
    MP21: "Version 2.1",
    MP20: "Version 2.0",
    MP14: "Version 1.4",
    MP13: "Version 1.3",
    MP12: "Version 1.2"
  };


  interface MPVersionOption extends vscode.QuickPickItem {
    label: string; // label is the long-name that is displaed in vscode
    version: string; // version is the shortname that is used internally by the microprofile starter api
  }

  const mpVersionOptions: MPVersionOption[] = [];
  for (const mpVersion of mpVersions) {
    if (MP_VERSION_LABELS[mpVersion] != null) {
      mpVersionOptions.push({
        label: MP_VERSION_LABELS[mpVersion],
        version: mpVersion
      });
    }
  }

  const mpVersionQuickPickResult = await vscode.window.showQuickPick(
    mpVersionOptions,
    { ignoreFocusOut: true, placeHolder: "Select a MicroProfile version." },
  );

  if (mpVersionQuickPickResult != null) {
    return mpVersionQuickPickResult.version;
  }

  return undefined;
}

async function askForMPserver(mpServers: string[]): Promise<string | undefined> {
  const MP_SERVER_LABELS: Record<string, string> = {
    LIBERTY: "Open Liberty",
    HELIDON: "Helidon",
    PAYARA_MICRO: "Payara Micro",
    THORNTAIL_V2: "Thorntail Version 2",
    KUMULUZEE: "KumuluzEE",
    TOMEE: "Apache TomEE 8.00-M2",
    WILDFLY_SWARM: "WildFly Swarm"
  };

  interface MPServerOption extends vscode.QuickPickItem {
    label: string; // label is the long-name that is displaed in vscode
    server: string; // server is the shortname that is used internally by the microprofile starter api
  }

  const mpServerOptions: MPServerOption[] = [];
  for (const mpServer of mpServers) {
    if (MP_SERVER_LABELS[mpServer] != null) {
      mpServerOptions.push({
        label: MP_SERVER_LABELS[mpServer],
        server: mpServer
      });
    }
  }

  const mpVersionQuickPickResult = await vscode.window.showQuickPick(
    mpServerOptions,
    { ignoreFocusOut: true, placeHolder: "Select a MicroProfile server." },
  );

  if (mpVersionQuickPickResult != null) {
    return mpVersionQuickPickResult.server;
  }
  return undefined;
}

async function askForMPSpecifications(specs: string[], specDescriptions: Record<string, string>): Promise<Array<string> | undefined> {
  interface MPSpecOption extends vscode.QuickPickItem {
    spec: string;
    label: string;
    detail: string;
  }

  const mpSpecOptions: MPSpecOption[] = specs.map(spec => {
    const fullDescriptionString = specDescriptions[spec];
    const [name, desc] = fullDescriptionString.split("-");
    return {
      spec: spec,
      label: name,
      detail: desc,
    };
  });

  const specResults: MPSpecOption[] | undefined = await vscode.window.showQuickPick(
    mpSpecOptions,
    { ignoreFocusOut: true, canPickMany: true, placeHolder: "Select MicroProfile specifications." },
  );

  if (specResults != null) {
    return specResults.map(result => result.spec);
  }
  return undefined;
}

export async function generateProject(): Promise<void> {
  try {
    const response = await rp.get("https://start.microprofile.io/api/2/supportMatrix");
    const mpSupportMatrix = JSON.parse(response);

    // map of MP version -> mp configuration
    const mpConfigurations = mpSupportMatrix.configs;
    const allMpVersions = Object.keys(mpConfigurations);

    const groupId = await askForGroupID();
    if (groupId === undefined) {
      return;
    }

    const artifactId = await askForArtifactID();
    if (artifactId === undefined) {
      return;
    }

    const javaSEVersion = await askForJavaSEVersion();
    if (javaSEVersion === undefined) {
      return;
    }

    const mpVersion = await askForMPVersion(allMpVersions);
    if (mpVersion === undefined) {
      return;
    }

    const allMpServers = mpConfigurations[mpVersion].supportedServers;

    const mpServer = await askForMPserver(allMpServers);
    if (mpServer === undefined) {
      return;
    }

    // all of the possible specs supported by the users selected version of microprofile
    const allSupportedSpecs = mpConfigurations[mpVersion].specs;
    const specDescriptions = mpSupportMatrix.descriptions;

    const mpSpecifications = await askForMPSpecifications(allSupportedSpecs, specDescriptions);
    if (mpSpecifications === undefined) {
      return;
    }

    const targetFolder = await openDialogForFolder({ openLabel: "Generate into this folder" });
    if (targetFolder === undefined) {
      return;
    }

    const targetDirString = targetFolder.fsPath;

    const payload = {
      groupId: groupId,
      artifactId: artifactId,
      mpVersion: mpVersion,
      supportedServer: mpServer,
      javaSEVersion: javaSEVersion,
      selectedSpecs: mpSpecifications,
    };

    const zipPath = targetDirString + "/" + artifactId + ".zip";

    const requestOptions = {
      url: "https://start.microprofile.io/api/2/project",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
    };

    request(requestOptions, (err) => {
      if (!err) {
        extract(zipPath, { dir: targetDirString }, async function (err: any) {
          // extraction is complete
          if (err !== undefined) {
            vscode.window.showErrorMessage("Could not extract the MicroProfile starter project.");
          } else {
            // open the unzipped folder in a new VS Code window
            const uri = vscode.Uri.file(targetDirString + "/" + artifactId);
            const openInNewWindow = vscode.workspace.workspaceFolders !== undefined;
            await vscode.commands.executeCommand("vscode.openFolder", uri, openInNewWindow);
          }

        });
      } else {
        vscode.window.showErrorMessage("Could not generate an MicroProfile starter project.");
      }
    }).pipe(fs.createWriteStream(zipPath));

  } catch (e) {
    console.error(e);
    vscode.window.showErrorMessage("Failed to generate a MicroProfile starter project");
  }
}
