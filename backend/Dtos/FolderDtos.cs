namespace DrawingDesk.Api.Dtos;

public record FolderDto(
    int Id,
    string Name,
    int? ParentFolderId,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreateFolderDto(string? Name, int? ParentFolderId);

public record UpdateFolderDto(string? Name, int? ParentFolderId);
