export interface CssVariableSnapshotValue {
  exists: boolean;
  value: string;
}

export type CssVariableSnapshot = Record<string, CssVariableSnapshotValue>;

interface StyleReader {
  getPropertyValue: (property: string) => string;
}

interface StyleWriter {
  setProperty: (property: string, value: string) => void;
  removeProperty: (property: string) => string;
}

export function snapshotCssVariables(variableNames: readonly string[], reader: StyleReader): CssVariableSnapshot {
  return variableNames.reduce<CssVariableSnapshot>((snapshot, variableName) => {
    const value = reader.getPropertyValue(variableName).trim();
    snapshot[variableName] = {
      exists: value.length > 0,
      value,
    };
    return snapshot;
  }, {});
}

export function restoreCssVariables(snapshot: CssVariableSnapshot, writer: StyleWriter) {
  Object.entries(snapshot).forEach(([variableName, saved]) => {
    if (saved.exists) {
      writer.setProperty(variableName, saved.value);
      return;
    }
    writer.removeProperty(variableName);
  });
}
