#!/usr/bin/env node
'use strict';

const { ArgumentParser } = require("argparse");
const path = require('path');
const fs = require('fs');
const spec = require('./style-spec');
const colorParser = require('csscolorparser');

require('./style-code');

// Parse command line
const args = (() => {
  const parser = new ArgumentParser({
      description: "MapLibre Shader Tools"
  });
  parser.add_argument("--root", "--r", {
      help: "Directory root to place generated code",
      required: false
  });
  return parser.parse_args();
})();

function parseCSSColor(str) {
  const color = colorParser.parseCSSColor(str);
  return [
      color[0] / 255 * color[3], color[1] / 255 * color[3], color[2] / 255 * color[3], color[3]
  ];
}

global.isLightProperty = function (property) {
  return property['light-property'] === true;
};

global.isOverridable = function (property) {
    return ['text-color'].includes(property.name);
};

global.expressionType = function (property) {
    switch (property.type) {
        case 'boolean':
            return 'BooleanType';
        case 'number':
        case 'enum':
            return 'NumberType';
        case 'image':
            return 'ImageType';
        case 'string':
            return 'StringType';
        case 'color':
            return `ColorType`;
        case 'formatted':
            return `FormattedType`;
        case 'array':
            return `Array<${expressionType({type: property.value})}>`;
        default: throw new Error(`unknown type for ${property.name}`)
    }
};

global.evaluatedType = function (property) {
  if (/-translate-anchor$/.test(property.name)) {
    return 'TranslateAnchorType';
  }
  if (/-(rotation|pitch|illumination)-alignment$/.test(property.name)) {
    return 'AlignmentType';
  }
  if (/^(text|icon)-anchor$/.test(property.name)) {
    return 'SymbolAnchorType';
  }
  if (/position/.test(property.name)) {
    return 'Position';
  }
  switch (property.type) {
  case 'boolean':
    return 'bool';
  case 'number':
    // TODO: Check if 'Rotation' should be used for other properties,
    // such as icon-rotate
    if (/bearing$/.test(property.name) &&
        property.period == 360 &&
        property.units =='degrees') {
      return 'Rotation';
    }
    return /location$/.test(property.name) ? 'double' : 'float';
  case 'resolvedImage':
      return 'expression::Image';
  case 'formatted':
    return 'expression::Formatted';
  case 'string':
    return 'std::string';
  case 'enum':
    return (isLightProperty(property) ? 'Light' : '') + `${camelize(property.name)}Type`;
  case 'color':
    return `Color`;
  case 'array':
    if (property.length) {
      return `std::array<${evaluatedType({type: property.value, name: property.name})}, ${property.length}>`;
    } else {
      return `std::vector<${evaluatedType({type: property.value, name: property.name})}>`;
    }
  default: throw new Error(`unknown type for ${property.name}`)
  }
};

function attributeUniformType(property, type) {
    const attributeNameExceptions = {
      'text-opacity': ['opacity'],
      'icon-opacity': ['opacity'],
      'text-color': ['fill_color'],
      'icon-color': ['fill_color'],
      'text-halo-color': ['halo_color'],
      'icon-halo-color': ['halo_color'],
      'text-halo-blur': ['halo_blur'],
      'icon-halo-blur': ['halo_blur'],
      'text-halo-width': ['halo_width'],
      'icon-halo-width': ['halo_width'],
      'line-gap-width': ['gapwidth'],
      'line-pattern': ['pattern_to', 'pattern_from'],
      'line-floor-width': ['floorwidth'],
      'fill-pattern': ['pattern_to', 'pattern_from'],
      'fill-extrusion-pattern': ['pattern_to', 'pattern_from']
    }
    const names = attributeNameExceptions[property.name] ||
       [ property.name.replace(type + '-', '').replace(/-/g, '_') ];

    return names.map(name => {
      return `attributes::${name}, uniforms::${name}`
    }).join(', ');
}

global.layoutPropertyType = function (property) {
  switch (property['property-type']) {
    case 'data-driven':
    case 'cross-faded-data-driven':
      return `DataDrivenLayoutProperty<${evaluatedType(property)}>`;
    default:
      return `LayoutProperty<${evaluatedType(property)}>`;
  }
};

global.paintPropertyType = function (property, type) {
  switch (property['property-type']) {
    case 'data-driven':
      if (isOverridable(property))
          return `DataDrivenPaintProperty<${evaluatedType(property)}, ${attributeUniformType(property, type)}, true>`;
      return `DataDrivenPaintProperty<${evaluatedType(property)}, ${attributeUniformType(property, type)}>`;
    case 'cross-faded-data-driven':
      return `CrossFadedDataDrivenPaintProperty<${evaluatedType(property)}, ${attributeUniformType(property, type)}>`;
    case 'cross-faded':
      return `CrossFadedPaintProperty<${evaluatedType(property)}>`;
    default:
      return `PaintProperty<${evaluatedType(property)}>`;
  }
};

global.propertyValueType = function (property) {
  switch (property['property-type']) {
    case 'color-ramp':
      return `ColorRampPropertyValue`;
    default:
      return `PropertyValue<${evaluatedType(property)}>`;
  }
};

function formatNumber(property, num = 0) {
  if (evaluatedType(property) === "float") {
    const str = num.toString();
    return str + (str.includes(".") ? "" : ".") + "f";
  }
  return num.toString();
}

global.defaultValue = function (property) {
  // https://github.com/mapbox/mapbox-gl-native/issues/5258
  if (property.name === 'line-round-limit') {
    return 1;
  }

  if (property.name === 'fill-outline-color') {
    return '{}';
  }

  if (property['property-type'] === 'color-ramp') {
      return '{}';
  }

  switch (property.type) {
  case 'number':
    return formatNumber(property, property.default);
  case 'formatted':
  case 'string':
  case 'resolvedImage':
    return property.default ? `{${JSON.stringify(property.default)}}` : '{}';
  case 'enum':
    if (property.default === undefined) {
      return `${evaluatedType(property)}::Undefined`;
    } else {
      return `${evaluatedType(property)}::${camelize(property.default)}`;
    }
  case 'color':
    const color = parseCSSColor(property.default).join(', ');
    switch (color) {
    case '0, 0, 0, 0':
      return '{}';
    case '0, 0, 0, 1':
      return 'Color::black()';
    case '1, 1, 1, 1':
      return 'Color::white()';
    default:
      return `{ ${color} }`;
    }
  case 'array':
    const defaults = (property.default || []).map((e) => defaultValue({ type: property.value, default: e }));
    if (property.length) {
      return `{{${defaults.join(', ')}}}`;
    } else {
      return `{${defaults.join(', ')}}`;
    }
  default:
    return property.default;
  }
};

console.log("Generating style code...");
const root = args.root ? args.root : path.dirname(__dirname);

const layerHpp = readAndCompile(`include/mbgl/style/layers/layer.hpp.ejs`, root);
const layerCpp = readAndCompile(`src/mbgl/style/layers/layer.cpp.ejs`, root);
const propertiesHpp = readAndCompile(`src/mbgl/style/layers/layer_properties.hpp.ejs`, root);
const propertiesCpp = readAndCompile(`src/mbgl/style/layers/layer_properties.cpp.ejs`, root);

const collator = new Intl.Collator("en-US");

// Add this mock property that our SDF line shader needs so that it gets added to the list of
// "data driven" properties.
spec.paint_line['line-floor-width'] = {
  "type": "number",
  "default": 1,
  "property-type": "data-driven"
};

const layers = Object.keys(spec.layer.type.values).map((type) => {
  const layoutProperties = Object.keys(spec[`layout_${type}`]).reduce((memo, name) => {
    if (name !== 'visibility') {
      spec[`layout_${type}`][name].name = name;
      memo.push(spec[`layout_${type}`][name]);
    }
    return memo;
  }, []);

  // JSON doesn't have a defined order. We're going to sort them alphabetically
  // to get a deterministic order.
  layoutProperties.sort((a, b) => collator.compare(a.name, b.name));

  const paintProperties = Object.keys(spec[`paint_${type}`]).reduce((memo, name) => {
    spec[`paint_${type}`][name].name = name;
    memo.push(spec[`paint_${type}`][name]);
    return memo;
  }, []);

  // JSON doesn't have a defined order. We're going to sort them alphabetically
  // to get a deterministic order.
  paintProperties.sort((a, b) => collator.compare(a.name, b.name));

  return {
    type: type,
    layoutProperties: layoutProperties,
    paintProperties: paintProperties,
    doc: spec.layer.type.values[type].doc,
    layoutPropertiesByName: spec[`layout_${type}`],
    paintPropertiesByName: spec[`paint_${type}`],
  };
});

for (const layer of layers) {
  const layerFileName = layer.type.replace('-', '_');

  writeIfModified(`src/mbgl/style/layers/${layerFileName}_layer_properties.hpp`, propertiesHpp(layer), root);
  writeIfModified(`src/mbgl/style/layers/${layerFileName}_layer_properties.cpp`, propertiesCpp(layer), root);

  // Remove our fake property for the external interace.
  if (layer.type === 'line') {
    layer.paintProperties = layer.paintProperties.filter(property => property.name !== 'line-floor-width');
  }

  writeIfModified(`include/mbgl/style/layers/${layerFileName}_layer.hpp`, layerHpp(layer), root);
  writeIfModified(`src/mbgl/style/layers/${layerFileName}_layer.cpp`, layerCpp(layer), root);
}

// Light
const lightProperties = Object.keys(spec[`light`]).reduce((memo, name) => {
  var property = spec[`light`][name];
  property.name = name;
  property['light-property'] = true;
  memo.push(property);
  return memo;
}, []);

// JSON doesn't have a defined order. We're going to sort them alphabetically
// to get a deterministic order.
lightProperties.sort((a, b) => collator.compare(a.name, b.name));

const lightHpp = readAndCompile(`include/mbgl/style/light.hpp.ejs`, root);
const lightCpp = readAndCompile(`src/mbgl/style/light.cpp.ejs`, root);
writeIfModified(`include/mbgl/style/light.hpp`, lightHpp({properties: lightProperties}), root);
writeIfModified(`src/mbgl/style/light.cpp`, lightCpp({properties: lightProperties}), root);
