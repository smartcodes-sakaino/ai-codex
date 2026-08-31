import type { Components } from "react-markdown";

const VIDEO_EXTENSION = /\.(mp4|webm|mov|m4v)$/i;

// Lesson markdown reuses the same `![label](url)` image syntax for videos
// (inserted by the same "insert at cursor" button/flow as images) rather
// than a separate syntax, so this just renders differently based on file
// extension — checked against the alt text (the original filename), not the
// URL, since uploaded files are served from Drive-backed object paths like
// `/objects/<fileId>` that carry no extension of their own. Applied
// everywhere lesson markdown is rendered — the editor, the learner view, and
// the admin view — since a video inserted in one must render as a video in
// all of them, not just show a broken image.
export const markdownVideoComponents: Components = {
  img: ({ src, alt }) => {
    if (typeof alt === "string" && VIDEO_EXTENSION.test(alt)) {
      return <video src={src} controls className="w-full rounded-lg" />;
    }
    return <img src={src} alt={alt} />;
  },
};
