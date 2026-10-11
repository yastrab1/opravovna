import { constrainComment } from "./page-comment";

// Imported comments can carry character styles that override object defaults.
// A highlighted range changes on its own; selecting the box formats all text.
export function styleAnnotation(
  object: any,
  key: string,
  value: any,
  pageWidth: number,
) {
  const text = object.type.toLowerCase().includes("text");
  const property = key === "color" ? (text ? "fill" : "stroke") : key;
  if (!text && key !== "color") return;
  if (text && object.isEditing && object.selectionEnd > object.selectionStart) {
    object.setSelectionStyles(
      { [property]: value },
      object.selectionStart,
      object.selectionEnd,
    );
  } else {
    if (text) object.removeStyle(property);
    object.set({ [property]: value });
  }
  object.dirty = true;
  if (text) object.initDimensions();
  constrainComment(object, pageWidth);
  object.setCoords();
}
