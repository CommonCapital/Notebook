namespace DrawingDesk.Api.Models;

/// <summary>
/// A single drawing document. The canvas itself lives in <see cref="SceneJson"/>
/// as a vector scene: a background plus a list of elements (strokes, shapes,
/// text, images). Storing it as JSON keeps every element re-editable and makes
/// saving cheap — we persist one JSON column, not a rasterized image.
/// </summary>
public class DrawingFile
{
    public int Id { get; set; }
    public string Name { get; set; } = "Untitled";

    public int? FolderId { get; set; }
    public Folder? Folder { get; set; }

    /// <summary>Canvas background as any CSS color, e.g. "#ffffff" or "#1e1e1e".</summary>
    public string BackgroundColor { get; set; } = "#ffffff";

    /// <summary>
    /// The vector scene document, stored verbatim as a JSON string. The API
    /// treats this as an opaque blob owned by the frontend's Konva renderer,
    /// so new element types never require a schema migration.
    /// Shape: { "elements": [ { "type": "stroke", ... }, ... ] }
    /// </summary>
    public string SceneJson { get; set; } = """{"elements":[]}""";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
