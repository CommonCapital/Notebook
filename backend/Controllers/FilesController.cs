using System.Text.Json;
using DrawingDesk.Api.Data;
using DrawingDesk.Api.Dtos;
using DrawingDesk.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DrawingDesk.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FilesController : ControllerBase
{
    private readonly AppDbContext _db;
    public FilesController(AppDbContext db) => _db = db;

    // GET /api/files            -> all files
    // GET /api/files?folderId=3 -> files in one folder (folderId=0 or null == root)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<FileSummaryDto>>> GetFiles([FromQuery] int? folderId)
    {
        var query = _db.Files.AsNoTracking().AsQueryable();
        if (Request.Query.ContainsKey("folderId"))
            query = query.Where(f => f.FolderId == folderId);

        var files = await query
            .OrderByDescending(f => f.UpdatedAt)
            .Select(f => new FileSummaryDto(
                f.Id, f.Name, f.FolderId, f.BackgroundColor, f.CreatedAt, f.UpdatedAt))
            .ToListAsync();

        return Ok(files);
    }

    // GET /api/files/{id} -> full file including scene
    [HttpGet("{id:int}")]
    public async Task<ActionResult<FileDetailDto>> GetFile(int id)
    {
        var file = await _db.Files.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return NotFound();
        return Ok(ToDetail(file));
    }

    // POST /api/files -> create a new (empty) file
    [HttpPost]
    public async Task<ActionResult<FileDetailDto>> CreateFile(CreateFileDto dto)
    {
        if (dto.FolderId is int fid && !await _db.Folders.AnyAsync(f => f.Id == fid))
            return BadRequest($"Folder {fid} does not exist.");

        var file = new DrawingFile
        {
            Name = string.IsNullOrWhiteSpace(dto.Name) ? "Untitled" : dto.Name.Trim(),
            FolderId = dto.FolderId,
            BackgroundColor = string.IsNullOrWhiteSpace(dto.BackgroundColor)
                ? "#ffffff" : dto.BackgroundColor,
        };

        _db.Files.Add(file);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetFile), new { id = file.Id }, ToDetail(file));
    }

    // PUT /api/files/{id} -> autosave: patch any subset of fields
    [HttpPut("{id:int}")]
    public async Task<ActionResult<FileDetailDto>> UpdateFile(int id, UpdateFileDto dto)
    {
        var file = await _db.Files.FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return NotFound();

        if (dto.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("Name cannot be blank.");
            file.Name = dto.Name.Trim();
        }

        if (dto.BackgroundColor is not null)
            file.BackgroundColor = dto.BackgroundColor;

        if (dto.Scene is JsonElement scene && scene.ValueKind != JsonValueKind.Undefined)
            file.SceneJson = scene.GetRawText();

        file.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ToDetail(file));
    }

    // PATCH /api/files/{id}/move -> move into a folder, or to root (folderId: null)
    [HttpPatch("{id:int}/move")]
    public async Task<ActionResult<FileDetailDto>> MoveFile(int id, MoveFileDto dto)
    {
        var file = await _db.Files.FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return NotFound();

        if (dto.FolderId is int fid && !await _db.Folders.AnyAsync(f => f.Id == fid))
            return BadRequest($"Folder {fid} does not exist.");

        file.FolderId = dto.FolderId;
        file.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ToDetail(file));
    }

    // DELETE /api/files/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteFile(int id)
    {
        var file = await _db.Files.FirstOrDefaultAsync(f => f.Id == id);
        if (file is null) return NotFound();

        _db.Files.Remove(file);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static FileDetailDto ToDetail(DrawingFile f)
    {
        using var doc = JsonDocument.Parse(f.SceneJson);
        return new FileDetailDto(
            f.Id, f.Name, f.FolderId, f.BackgroundColor,
            doc.RootElement.Clone(), f.CreatedAt, f.UpdatedAt);
    }
}
