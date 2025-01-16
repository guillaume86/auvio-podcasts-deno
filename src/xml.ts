import {
  X2jOptions,
  XMLBuilder,
  XmlBuilderOptions,
  XMLParser,
} from "npm:fast-xml-parser@4.3.4";

const options: X2jOptions & XmlBuilderOptions = {
  ignoreAttributes: false,
  cdataPropName: "__cdata",
};

export function parseXML<T>(xml: string) {
  const parser = new XMLParser(options);
  return parser.parse(xml) as T;
}

export function buildXML(obj: any): string {
  const builder = new XMLBuilder(options);
  return builder.build(obj);
}
