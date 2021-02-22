const exprima = require("esprima");
const escodegen = require("escodegen");
const fs = require("fs");

class Parser {
  constructor(entryModule) {
    this.importedVals = new Map();
    this.exportedVals = [];
    this.moduleSet = [];
    this.module = entryModule;

    //bind bc no transform source
    this.followImportSources = this.followImportSources.bind(this);
  }
  followImportSources({ source }) {
    const followModule = source.value.replace("./", "");
    followModule.length
      ? (() => {
          debugger;
          this.extractImports(followModule);
          this.moduleSet.push({
            name: followModule,
            module: this.parseModule(`/modules/${followModule}.js`),
          });
        })()
      : undefined;
  }
  parseModule(relPath) {
    // console.log(relPath, fs.readFileSync(__dirname + relPath));
    const codeBuffer = fs.readFileSync(__dirname + relPath);
    return exprima.parseModule(codeBuffer.toString());
  }

  extractImports(module) {
    debugger;
    const extractedImports = this.traverseSyntaxTree({
      AST: this.parseModule(`/modules/${module}.js`),
      extractType: "ImportDeclaration",
      recursiveCaller: this.followImportSources,
      extractor: (node) => {
        return node.specifiers.map((val) => val.imported.name);
      },
    });

    // console.log("extractedImports==", extractedImports);
    // console.log(this);
    extractedImports.forEach((imp) =>
      this.importedVals.set(imp, imp.toString())
    );
    return this.importedVals;
  }
  traverseSyntaxTree({
    AST,
    extractType,
    extractor,
    recursiveCaller = (nope) => nope,
  }) {
    debugger;
    const { body } = AST;
    let extractedNodes = [];
    body.forEach((node) => {
      debugger;
      if (extractType === node.type) {
        const extractedVals = extractor(node);
        extractedNodes = [...extractedNodes, ...extractedVals];
        // console.log(extractedNodes);
        recursiveCaller(node);
      }
    });
    return extractedNodes;
  }

  get Imports() {
    // console.log("getting imports calling");
    return this.importedVals.length
      ? this.importedVals
      : this.extractImports(this.module);
  }
}

class TreeShaker {
  constructor({ Imports, moduleSet }) {
    console.log("moduleSet", moduleSet);
    this.unshaked = moduleSet;
    this.modules = TreeShaker.shake(moduleSet, Imports);
  }
  static shake(modules, importedVals) {
    return Array.from(modules.entries()).map(([, { module: m, name }]) => {
      const module = { ...m };
      const { body } = module;
      const shakeBody = [];

      body.forEach((node) => {
        if (node.type === "ExportNamedDeclaration") {
          node.declaration.declarations.forEach(({ id }) => {
            if (importedVals.has(id.name)) {
              shakeBody.push(node);
            }
          });
        } else {
          shakeBody.push(node);
        }
      });
      module.body = shakeBody;
      return module;
    });
  }

  get Unshaked() {
    return this.unshaked;
  }
  get Modules() {
    return this.modules;
  }
}
console.log(new Parser("module1").moduleSet);
debugger;
const shakeItBaby = new TreeShaker(new Parser("module1"));
const moduleStringOptimized = shakeItBaby.Modules.map((m) =>
  escodegen.generate(m)
).join("");

const moduleStringUnshaked = shakeItBaby.Unshaked.map((u) =>
  escodegen.generate(u.module)
).join("");
console.log("\n\n\nmoduleStringOptimized::", moduleStringOptimized);
console.log("\n\n\n moduleStringUnshaked::", moduleStringUnshaked);

console.log(1 - moduleStringOptimized.length / moduleStringUnshaked.length);
const impr = Math.floor(
  (1 - moduleStringOptimized.length / moduleStringUnshaked.length) * 100
);

console.log("improvement:::", impr, "%");
