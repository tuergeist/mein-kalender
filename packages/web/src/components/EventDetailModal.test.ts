import { describe, it, expect } from "vitest";

// Extract stripHtml for testing - mirrors the implementation in EventDetailModal
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
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

  it("handles Microsoft Teams HTML description", () => {
    const teamsHtml = `<div style="margin-bottom:18.0pt; overflow:hidden">
<p class="MsoNormal"><span class="me-email-text"><b><span lang="EN-GB" style="font-size:15.0pt; font-family:&quot;Segoe UI&quot;,sans-serif; color:#242424">Microsoft Teams meeting</span></b></span></p>
</div>
<div style="margin-bottom:4.5pt">
<p class="MsoNormal"><span class="me-email-text"><b><span lang="EN-GB" style="font-size:15.0pt; font-family:&quot;Segoe UI&quot;,sans-serif; color:#242424">Join:</span></b></span></p>
</div>`;
    const result = stripHtml(teamsHtml);
    expect(result).toContain("Microsoft Teams meeting");
    expect(result).toContain("Join:");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("collapses excessive newlines", () => {
    // </p> adds \n, plus 3 literal \n, plus <p> stripped = 4 newlines -> collapsed to 2
    expect(stripHtml("<p>a</p>\n\n\n<p>b</p>")).toBe("a\n\nb");
  });

  it("trims whitespace", () => {
    expect(stripHtml("  <p>hello</p>  ")).toBe("hello");
  });
});
