// src/ifc-parser.js

import fs from 'fs/promises';
import path from 'path';
import { IfcAPI, IFCRELDEFINESBYPROPERTIES,  IFCRELASSOCIATESDOCUMENT,  IFCMATERIAL, IFCSIUNIT,IFCPROJECT,  IFCUNITASSIGNMENT } from 'web-ifc';

// This helper is now used by all functions for consistency.
async function initializeAndLoadIfc(projectPath) {
    const ifcFileName = `${path.basename(projectPath)}.ifc`;
    const ifcFilePath = path.join(projectPath, ifcFileName);
    const ifcApi = new IfcAPI();
    await ifcApi.SetWasmPath('./');
    await ifcApi.Init();
    
    try {
        const data = await fs.readFile(ifcFilePath);
        const uint8array = new Uint8Array(data);
        const modelID = ifcApi.OpenModel(uint8array);
        return { ifcApi, modelID };
    } catch (err) {
        console.error(`[IFC Parser] Error reading or opening IFC file at ${ifcFilePath}:`, err);
        return { ifcApi: null, modelID: -1 };
    }
}

// --- START: NEW, ADVANCED HEADER PARSER ---
function parseIfcHeader(ifcContent) {
  const data = {
    viewDefinition: null,
    lastModified: null,
    author: null, authorEmail: null,
    organization: null, organizationEmail: null,
    authorizer: null,
    schema: null,
  };

  // Regex to find FILE_DESCRIPTION and capture the ViewDefinition
  const descMatch = ifcContent.match(/FILE_DESCRIPTION\(\s*\(\s*'([^']*)'/);
  if (descMatch) data.viewDefinition = descMatch[1];

  // Regex to find FILE_SCHEMA and capture the schema version
  const schemaMatch = ifcContent.match(/FILE_SCHEMA\(\s*\(\s*'([^']*)'/);
  if (schemaMatch) data.schema = schemaMatch[1];

  // Regex to find and parse the complex FILE_NAME line
  const nameMatch = ifcContent.match(/FILE_NAME\(([\s\S]*?)\);/);
  if (nameMatch) {
    const content = nameMatch[1];
    // This regex is designed to be robust and handle the nested parentheses for author/org.
    const parts = content.match(/'[^']*'|\([^)]*\)/g).map(p => p.trim().replace(/['()]/g, ''));
    
    if (parts.length >= 7) {
      data.lastModified = new Date(parts[1]).toLocaleString(); // Format date for display
      const authorInfo = parts[2].split(',');
      const orgInfo = parts[3].split(',');
      data.author = authorInfo[0] || null;
      data.authorEmail = authorInfo[1] || null;
      data.organization = orgInfo[0] || null;
      data.organizationEmail = orgInfo[1] || null;
      data.authorizer = parts[6] || null;
    }
  }
  return data;
}
// --- END: NEW, ADVANCED HEADER PARSER ---

export async function getProjectCardData(projectPath) {
  const ifcFileName = `${path.basename(projectPath)}.ifc`;
  const ifcFilePath = path.join(projectPath, ifcFileName);
  let projectData = {
    projectName: path.basename(projectPath),
    previewImagePath: null,
    projectPath: projectPath,
  };

  let ifcApi = null;
  let modelID = -1;

  try {
    const ifcContent = await fs.readFile(ifcFilePath, 'utf8');
    Object.assign(projectData, parseIfcHeader(ifcContent));

    const loadResult = await initializeAndLoadIfc(projectPath);
    ifcApi = loadResult.ifcApi;
    modelID = loadResult.modelID;
    if (modelID === -1) return projectData;

    const projectLines = await ifcApi.GetLineIDsWithType(modelID, IFCPROJECT);
    if (projectLines.size() > 0) {
      const project = await ifcApi.GetLine(modelID, projectLines.get(0));
      if (project.Name?.value) projectData.projectName = project.Name.value;
    }

    const assetMap = await getDrawingToAssetMap(projectPath);
    const typeMap = {};
    for (const drawingName in assetMap) {
        const rawType = assetMap[drawingName]['TargetView'];
        if (rawType) {
            if (rawType.includes('PLAN')) typeMap[drawingName] = 'plan';
            else if (rawType.includes('ELEVATION')) typeMap[drawingName] = 'elevation';
            else if (rawType.includes('SECTION')) typeMap[drawingName] = 'section';
            else if (rawType.includes('3D')) typeMap[drawingName] = '3d';
            else typeMap[drawingName] = 'default';
        } else {
            typeMap[drawingName] = 'default';
        }
    }
    const drawings = Object.keys(typeMap);
    const sectionDrawing = drawings.find(d => typeMap[d] === 'section');
    const planDrawing = drawings.find(d => typeMap[d] === 'plan');
    const previewDrawingName = sectionDrawing || planDrawing;
    if (previewDrawingName) {
      projectData.previewImagePath = path.join(projectPath, 'drawings', previewDrawingName);
    }
    return projectData;
  } catch (error) {
    console.error(`[IFC Parser] Critical error in getProjectCardData for ${projectPath}:`, error);
    return projectData;
  } finally {
    if (ifcApi && modelID !== -1) {
      ifcApi.CloseModel(modelID);
    }
  }
}

export async function getDrawingToAssetMap(projectPath) {
    const drawingToAssetMap = {};
    const { ifcApi, modelID } = await initializeAndLoadIfc(projectPath);
    if (modelID === -1) return drawingToAssetMap;
    try {
        const relDefinesByProperties = await ifcApi.GetLineIDsWithType(modelID, IFCRELDEFINESBYPROPERTIES);
        for (let i = 0; i < relDefinesByProperties.size(); i++) {
            const rel = await ifcApi.GetLine(modelID, relDefinesByProperties.get(i));
            if (rel.RelatingPropertyDefinition) {
                const pset = await ifcApi.GetLine(modelID, rel.RelatingPropertyDefinition.value);
                if (pset.Name?.value === 'EPset_Drawing') {
                    const assetData = {};
                    let drawingName = '';
                    if (pset.HasProperties) {
                        for (const propID of pset.HasProperties) {
                            const prop = await ifcApi.GetLine(modelID, propID.value);
                            if (prop.Name?.value && prop.NominalValue?.value) assetData[prop.Name.value] = prop.NominalValue.value;
                        }
                    }
                    const relDocs = await ifcApi.GetLineIDsWithType(modelID, IFCRELASSOCIATESDOCUMENT);
                    for (let j = 0; j < relDocs.size(); j++) {
                        const assoc = await ifcApi.GetLine(modelID, relDocs.get(j));
                        if (assoc.RelatedObjects?.some(obj => rel.RelatedObjects?.some(ro => ro.value === obj.value))) {
                            const docRef = await ifcApi.GetLine(modelID, assoc.RelatingDocument.value);
                            if (docRef.ReferencedDocument) {
                                const docInfo = await ifcApi.GetLine(modelID, docRef.ReferencedDocument.value);
                                if (docInfo.Name?.value) drawingName = docInfo.Name.value + '.svg';
                            }
                        }
                    }
                    if (drawingName) drawingToAssetMap[drawingName] = assetData;
                }
            }
        }
    } catch (e) {
        console.error('[IFC Parser] Error while parsing for assets:', e);
    } finally {
        ifcApi.CloseModel(modelID);
    }
    return drawingToAssetMap;
}

// --- REPLACE getDrawingTypeMap WITH THIS ---
export async function getDrawingTargetViewMap(projectPath) {
    const fullAssetMap = await getDrawingToAssetMap(projectPath);
    const targetViewMap = {};
    for (const drawingName in fullAssetMap) {
        // Return the raw TargetView value, or 'Uncategorized' as a fallback.
        targetViewMap[drawingName] = fullAssetMap[drawingName]['TargetView'] || 'Uncategorized';
    }
    return targetViewMap;
}

export async function getMaterialsFromIFC(projectPath) {
    const materialCategories = {};
    const { ifcApi, modelID } = await initializeAndLoadIfc(projectPath);
    if (modelID === -1) return materialCategories;
    try {
        const materialIDs = await ifcApi.GetLineIDsWithType(modelID, IFCMATERIAL);
        for (let i = 0; i < materialIDs.size(); i++) {
            const material = await ifcApi.GetLine(modelID, materialIDs.get(i));
            if (material.Name?.value) {
                materialCategories[material.Name.value] = material.Category?.value || 'Uncategorized';
            }
        }
    } catch(e) {
        console.error('[IFC Parser] Error while parsing for materials:', e);
    } finally {
        ifcApi.CloseModel(modelID);
    }
    return materialCategories;
}

export async function getProjectUnits(projectPath) {
    let lengthUnit = null;
    const { ifcApi, modelID } = await initializeAndLoadIfc(projectPath);
    if (modelID === -1) return null;
    try {
        const projectLines = await ifcApi.GetLineIDsWithType(modelID, IFCPROJECT);
        if (projectLines.size() > 0) {
            const project = await ifcApi.GetLine(modelID, projectLines.get(0));
            if (project.UnitsInContext?.value) {
                const unitAssignment = await ifcApi.GetLine(modelID, project.UnitsInContext.value);
                if (unitAssignment.Units) {
                    for (const unitRef of unitAssignment.Units) {
                        const unit = await ifcApi.GetLine(modelID, unitRef.value);
                        if (unit.type === IFCSIUNIT && unit.UnitType?.value.includes('LENGTHUNIT')) {
                            if (unit.Name?.value) lengthUnit = unit.Name.value.toLowerCase().replace(/\./g, '');
                            break;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('[IFC Parser] Error while parsing for project units:', e);
    } finally {
        ifcApi.CloseModel(modelID);
    }
    return lengthUnit;
}

