import { describe, it, expect } from "vitest";

// Extract stripHtml for testing - mirrors the implementation in EventDetailModal
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, (_, url, text) => {
      const cleanText = text.trim();
      if (cleanText === url || cleanText.replace(/^https?:\/\//, "") === url.replace(/^https?:\/\//, "")) return url;
      return `${cleanText} (${url})`;
    })
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

describe("stripHtml", () => {
  it("returns plain text unchanged", () => {
    expect(stripHtml("Hello world")).toBe("Hello world");
  });

  it("strips simple HTML tags", () => {
    expect(stripHtml("<b>bold</b> and <i>italic</i>")).toBe("bold and italic");
  });

  it("converts br tags to newlines", () => {
    expect(stripHtml("line1<br>line2<br/>line3")).toBe("line1\nline2\nline3");
  });

  it("converts closing block tags to newlines", () => {
    expect(stripHtml("<p>para1</p><p>para2</p>")).toBe("para1\npara2");
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &#39; &nbsp;")).toBe('& < > " \'');
  });

  it("preserves link URLs with different text", () => {
    expect(stripHtml('<a href="https://example.com">Click here</a>')).toBe(
      "Click here (https://example.com)"
    );
  });

  it("does not duplicate URL when link text matches href", () => {
    expect(stripHtml('<a href="https://example.com">https://example.com</a>')).toBe(
      "https://example.com"
    );
  });

  it("preserves Teams meeting join link", () => {
    const teamsLink = '<a href="https://teams.microsoft.com/meet/123" title="Meeting join">https://teams.microsoft.com/meet/123</a>';
    const result = stripHtml(teamsLink);
    expect(result).toContain("https://teams.microsoft.com/meet/123");
  });

  it("handles Microsoft Teams HTML description with links", () => {
    const teamsHtml = `<div style="margin-bottom:18.0pt; overflow:hidden">
<p class="MsoNormal"><b>Microsoft Teams meeting</b></p>
</div>
<div style="margin-bottom:4.5pt">
<p class="MsoNormal"><b>Join:</b> <a href="https://teams.microsoft.com/meet/123" title="Meeting join">https://teams.microsoft.com/meet/123</a></p>
</div>`;
    const result = stripHtml(teamsHtml);
    expect(result).toContain("Microsoft Teams meeting");
    expect(result).toContain("https://teams.microsoft.com/meet/123");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("collapses excessive newlines", () => {
    expect(stripHtml("<p>a</p>\n\n\n<p>b</p>")).toBe("a\n\nb");
  });

  it("trims whitespace", () => {
    expect(stripHtml("  <p>hello</p>  ")).toBe("hello");
  });
});
