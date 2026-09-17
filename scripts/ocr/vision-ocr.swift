// Apple Vision OCR for typewritten pages (macOS only; no dependencies).
//   swift scripts/ocr/vision-ocr.swift <image> [<image>…]   → one JSON object per image: {"file","lines":"[{text,x,y,h}…]","confidence"}
// Used by scripts/ocr-transcripts.js. Vision reads a monospaced typewriter
// page with far fewer errors than tesseract; lines come back top-to-bottom.
import Foundation
import Vision
import AppKit

func ocr(_ path: String) -> (String, Double) {
  guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return ("", 0) }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  req.usesLanguageCorrection = true
  req.recognitionLanguages = ["en-US"]
  let handler = VNImageRequestHandler(cgImage: cg, options: [:])
  do { try handler.perform([req]) } catch { return ("", 0) }
  guard let obs = req.results else { return ("", 0) }
  // sort by vertical position (top first), then left-to-right
  let sorted = obs.sorted { a, b in
    let ay = a.boundingBox.midY, by = b.boundingBox.midY
    if abs(ay - by) > 0.008 { return ay > by }
    return a.boundingBox.minX < b.boundingBox.minX
  }
  // one JSON line per text line with its box, so the caller can find paragraph gaps
  var lines: [[String: Any]] = []; var conf = 0.0; var n = 0
  for o in sorted { if let c = o.topCandidates(1).first { lines.append(["text": c.string, "y": 1 - o.boundingBox.maxY, "h": o.boundingBox.height, "x": o.boundingBox.minX]); conf += Double(c.confidence); n += 1 } }
  if let data = try? JSONSerialization.data(withJSONObject: lines), let s = String(data: data, encoding: .utf8) { return (s, n > 0 ? conf / Double(n) : 0) }
  return ("[]", 0)
}

for path in CommandLine.arguments.dropFirst() {
  let (text, conf) = ocr(path)
  let obj: [String: Any] = ["file": path, "lines": text, "confidence": conf]
  if let data = try? JSONSerialization.data(withJSONObject: obj), let s = String(data: data, encoding: .utf8) { print(s) }
}
