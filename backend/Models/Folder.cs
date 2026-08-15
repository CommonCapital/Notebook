namespace DrawingDesk.Api.Models;

/// <summary>
/// A folder in the file tree. Folders can nest via <see cref="ParentFolderId"/>.
/// </summary>
public class Folder
{
    public int Id { get; set; }
    public string Name { get; set; } = "Untitled folder";

    // Self-referencing nesting. Null == lives at the root.
    public int? ParentFolderId { get; set; }
    public Folder? ParentFolder { get; set; }

    public ICollection<Folder> Children { get; set; } = new List<Folder>();
    public ICollection<DrawingFile> Files { get; set; } = new List<DrawingFile>();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
