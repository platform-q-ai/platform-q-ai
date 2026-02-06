import Config

config :alkali,
  site: %{
    title: "Platform Q AI",
    url: "https://platformq.ai",
    author: "Platfrrom Q",
    # Base path for URLs - use "" for relative links (works with file:// and web root)
    # or "/blog" for subdirectory hosting (e.g., example.com/blog/)
    base_path: "",
    theme: %{
      accent_color: "#ff5722"
    }
  },
  paths: %{
    content: "content",
    layouts: "layouts",
    static: "static",
    output: "_site"
  },
  defaults: %{
    post_layout: "post",
    page_layout: "page"
  }
