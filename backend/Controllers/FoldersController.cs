using Notebook.Api.Data;
using Notebook.Api.Dtos;
using Notebook.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Notebook.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FoldersController : ControllerBase
{
    private readonly AppDbContext _db;
    public FoldersController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FolderDto>>> GetFolders()
    {
        var folders = await _db.Folders.AsNoTracking()
            .OrderBy(f => f.Name)
            .Select(f => new FolderDto(f.Id, f.Name, f.ParentFolderId, f.CreatedAt, f.UpdatedAt))
            .ToListAsync();
        return Ok(folders);
    }

    [HttpPost]
    public async Task<ActionResult<FolderDto>> CreateFolder(CreateFolderDto dto)
    {
        if (dto.ParentFolderId is int pid && !await _db.Folders.AnyAsync(f => f.Id == pid))
            return BadRequest($"Parent folder {pid} does not exist.");

        var folder = new Folder
        {
            Name = string.IsNullOrWhiteSpace(dto.Name) ? "Untitled folder" : dto.Name.Trim(),
            ParentFolderId = dto.ParentFolderId,
        };
        _db.Folders.Add(folder);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetFolders), new { id = folder.Id },
            new FolderDto(folder.Id, folder.Name, folder.ParentFolderId, folder.CreatedAt, folder.UpdatedAt));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<FolderDto>> UpdateFolder(int id, UpdateFolderDto dto)
    {
        var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id);
        if (folder is null) return NotFound();

        if (dto.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name cannot be blank.");
            folder.Name = dto.Name.Trim();
        }

        if (dto.ParentFolderId is int pid)
        {
            if (pid == id) return BadRequest("A folder cannot be its own parent.");
            if (!await _db.Folders.AnyAsync(f => f.Id == pid))
                return BadRequest($"Parent folder {pid} does not exist.");
            folder.ParentFolderId = pid;
        }

        folder.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new FolderDto(folder.Id, folder.Name, folder.ParentFolderId, folder.CreatedAt, folder.UpdatedAt));
    }

    // Deletes the folder and (via cascade) its subfolders and files.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteFolder(int id)
    {
        var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id);
        if (folder is null) return NotFound();

        _db.Folders.Remove(folder);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
