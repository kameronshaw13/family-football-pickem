import type { ReactNode } from "react";

export default function NumericText({ text }: { text: string | number }) {
  const characters = Array.from(String(text));
  const isDigit = (character?: string) => Boolean(character && /\d/.test(character));
  const isNumericSymbol = (character: string) => !isDigit(character) && !/\s/.test(character) && character.toUpperCase() === character.toLowerCase();
  const parts: ReactNode[] = characters.map((character, index) => {
    if (!isNumericSymbol(character)) return character;
    const followsNumber = isDigit(characters[index - 1]);
    const precedesNumber = isDigit(characters[index + 1]);
    if (!followsNumber && !precedesNumber) return character;
    return <span
      className={`numeric-symbol ${followsNumber ? "numeric-symbol-after" : ""} ${precedesNumber ? "numeric-symbol-before" : ""}`}
      key={index}
    >{character}</span>;
  });

  return <span className="numeric-token">{parts}</span>;
}
