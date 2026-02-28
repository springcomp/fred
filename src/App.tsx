import { Toolbar } from "./components/Toolbar";
import { SplitPane } from "./components/SplitPane";
import { SchemaTree } from "./components/tree/SchemaTree";
import { PropertySheet } from "./components/properties/PropertySheet";

export function App() {
  return (
    <div className="flex flex-col h-full">
      <Toolbar />
      <SplitPane
        left={<SchemaTree />}
        right={<PropertySheet />}
        defaultWidth={360}
        minWidth={200}
        maxWidth={600}
      />
    </div>
  );
}
