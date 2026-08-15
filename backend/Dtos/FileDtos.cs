using System.Text.Json;
using System.Text.Json.Serialization;

namespace DrawingDesk.Api.Dtos;

/// <summary>Lightweight file summary for the file-browser list (no scene payload).</summary>
public record FileSummaryDto(
    int Id,
    string Name,
    int? FolderId,
    string BackgroundColor,
    DateTime CreatedAt,
    DateTime UpdatedAt);

/// <summary>Full file including the canvas scene, returned when opening a file.</summary>
public record FileDetailDto(
    int Id,
    string Name,
    int? FolderId,
    string BackgroundColor,
    // Sent to the client as a parsed JSON object, not a JSON-encoded string.
    [property: JsonPropertyName("scene")] JsonElement Scene,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreateFileDto(
    string? Name,
    int? FolderId,
    string? BackgroundColor);

/// <summary>
/// Content autosave. Name/background/scene are each optional (null == leave
/// unchanged), so the client can PUT just the scene while drawing or just the
/// name on rename. Moving between folders is a separate endpoint so that
/// "move to root" (folderId = null) is unambiguous.
/// </summary>
public record UpdateFileDto(
    string? Name,
    string? BackgroundColor,
    [property: JsonPropertyName("scene")] JsonElement? Scene);

/// <summary>Move a file into a folder, or to the root when FolderId is null.</summary>
public record MoveFileDto(int? FolderId);
