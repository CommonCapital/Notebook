using System.Text.Json;
using System.Text.Json.Serialization;

namespace Notebook.Api.Dtos;

/// <summary>
/// Strongly-typed contract for the canvas scene the frontend sends. Every current
/// frontend element type has a matching record here so the backend models the full
/// schema and can validate each element's shape. Unknown/newer types are tolerated
/// (validated only for id + type) and preserved via <see cref="SceneElementDto.Extra"/>,
/// so adding a frontend element type never breaks the API. The raw JSON is stored
/// verbatim (see FilesController) so nothing is dropped on round-trip.
/// </summary>
public class SceneDto
{
    [JsonPropertyName("elements")]
    public List<SceneElementDto> Elements { get; set; } = new();

    /// <summary>blank | grid | lines | dots — the notebook paper style.</summary>
    [JsonPropertyName("backgroundStyle")]
    public string? BackgroundStyle { get; set; }
}

public class SceneElementDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("type")] public string Type { get; set; } = "";

    // Any property not modelled on the concrete record lands here, so the typed
    // records never drop fields and stay forward-compatible.
    [JsonExtensionData] public Dictionary<string, JsonElement>? Extra { get; set; }

    /// <summary>Maps a scene element's "type" to the record that models it.</summary>
    public static readonly IReadOnlyDictionary<string, Type> Registry = new Dictionary<string, Type>
    {
        ["stroke"] = typeof(StrokeElementDto),
        ["line"] = typeof(StrokeElementDto),
        ["arrow"] = typeof(StrokeElementDto),
        ["rect"] = typeof(ShapeBoxDto),
        ["ellipse"] = typeof(EllipseElementDto),
        ["diamond"] = typeof(ShapeBoxDto),
        ["triangle"] = typeof(ShapeBoxDto),
        ["text"] = typeof(TextElementDto),
        ["image"] = typeof(ImageElementDto),
        ["math"] = typeof(MathElementDto),
        ["table"] = typeof(TableElementDto),
        ["chart"] = typeof(ChartElementDto),
        ["graph"] = typeof(GraphElementDto),
    };
}

// --- Point-based (stroke / line / arrow) ---
public class StrokeElementDto : SceneElementDto
{
    [JsonPropertyName("points")] public double[] Points { get; set; } = [];
    [JsonPropertyName("color")] public string Color { get; set; } = "#000000";
    [JsonPropertyName("width")] public double Width { get; set; }
}

// --- Box-based ---
public class BoxElementDto : SceneElementDto
{
    [JsonPropertyName("x")] public double X { get; set; }
    [JsonPropertyName("y")] public double Y { get; set; }
    [JsonPropertyName("width")] public double Width { get; set; }
    [JsonPropertyName("height")] public double Height { get; set; }
}

// rect / diamond / triangle
public class ShapeBoxDto : BoxElementDto
{
    [JsonPropertyName("stroke")] public string Stroke { get; set; } = "#000000";
    [JsonPropertyName("fill")] public string Fill { get; set; } = "transparent";
    [JsonPropertyName("strokeWidth")] public double StrokeWidth { get; set; }
}

public class EllipseElementDto : SceneElementDto
{
    [JsonPropertyName("x")] public double X { get; set; }
    [JsonPropertyName("y")] public double Y { get; set; }
    [JsonPropertyName("radiusX")] public double RadiusX { get; set; }
    [JsonPropertyName("radiusY")] public double RadiusY { get; set; }
    [JsonPropertyName("stroke")] public string Stroke { get; set; } = "#000000";
    [JsonPropertyName("fill")] public string Fill { get; set; } = "transparent";
    [JsonPropertyName("strokeWidth")] public double StrokeWidth { get; set; }
}

public class TextElementDto : SceneElementDto
{
    [JsonPropertyName("x")] public double X { get; set; }
    [JsonPropertyName("y")] public double Y { get; set; }
    [JsonPropertyName("text")] public string Text { get; set; } = "";
    [JsonPropertyName("fontSize")] public double FontSize { get; set; }
    [JsonPropertyName("fill")] public string Fill { get; set; } = "#000000";
}

public class ImageElementDto : BoxElementDto
{
    [JsonPropertyName("src")] public string Src { get; set; } = "";
}

public class MathElementDto : BoxElementDto
{
    [JsonPropertyName("latex")] public string Latex { get; set; } = "";
    [JsonPropertyName("color")] public string Color { get; set; } = "#000000";
}

public class TableElementDto : BoxElementDto
{
    [JsonPropertyName("rows")] public int Rows { get; set; }
    [JsonPropertyName("cols")] public int Cols { get; set; }
    [JsonPropertyName("cells")] public List<List<string>> Cells { get; set; } = new();
    [JsonPropertyName("headerRow")] public bool HeaderRow { get; set; }
    [JsonPropertyName("textColor")] public string TextColor { get; set; } = "#111827";
    [JsonPropertyName("borderColor")] public string BorderColor { get; set; } = "#cbd5e1";
    [JsonPropertyName("headerFill")] public string HeaderFill { get; set; } = "#eef2f7";
}

public class ChartPointDto
{
    [JsonPropertyName("label")] public string Label { get; set; } = "";
    [JsonPropertyName("value")] public double Value { get; set; }
}

public class ChartElementDto : BoxElementDto
{
    [JsonPropertyName("chartType")] public string ChartType { get; set; } = "bar";
    [JsonPropertyName("title")] public string Title { get; set; } = "";
    [JsonPropertyName("data")] public List<ChartPointDto> Data { get; set; } = new();
}

public class GraphFuncDto
{
    [JsonPropertyName("expr")] public string Expr { get; set; } = "";
    [JsonPropertyName("color")] public string Color { get; set; } = "#000000";
}
public class GraphElementDto : BoxElementDto
{
    [JsonPropertyName("funcs")] public List<GraphFuncDto> Funcs { get; set; } = new();
    [JsonPropertyName("xMin")] public double XMin { get; set; }
    [JsonPropertyName("xMax")] public double XMax { get; set; }
    [JsonPropertyName("yMin")] public double YMin { get; set; }
    [JsonPropertyName("yMax")] public double YMax { get; set; }
}
