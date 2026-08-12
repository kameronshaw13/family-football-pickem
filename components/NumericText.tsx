import type { ReactNode } from "react";

export default function NumericText({ text }: { text: string | number }) {
  const tokens = String(text).split(/(\s+)/);
  const isDigit = (character?: string) => Boolean(character && /\d/.test(character));
  const isNumericSymbol = (character: string) => !isDigit(character) && !/\s/.test(character) && character.toUpperCase() === character.toLowerCase();
  const parts: ReactNode[] = tokens.map((token, tokenIndex) => {
    if (/^\s+$/.test(token) || !/\d/.test(token)) return token;
    const characters = Array.from(token);
    const tokenParts = characters.map((character, characterIndex) => {
      if (!isNumericSymbol(character)) return character;
      const followsNumber = isDigit(characters[characterIndex - 1]);
      const precedesNumber = isDigit(characters[characterIndex + 1]);
      if (!followsNumber && !precedesNumber) return character;
      return <span
        className={`numeric-symbol ${followsNumber ? "numeric-symbol-after" : ""} ${precedesNumber ? "numeric-symbol-before" : ""}`}
        key={characterIndex}
      >{character}</span>;
    });
    return <span className="numeric-fragment" key={tokenIndex}>{tokenParts}</span>;
  });

  return <span className="numeric-token">{parts}</span>;
}
