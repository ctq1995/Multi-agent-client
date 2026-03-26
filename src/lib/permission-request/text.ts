export function unescapeInlineEscapes(input: string): string {
  return input.replace(/\\n/g, "\n").replace(/\\t/g, "\t")
}
