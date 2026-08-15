using System.Text.Json;
using Notebook.Api.Data;
using Notebook.Api.Dtos;
using Notebook.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Notebook.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FilesController : ControllerBase
{
    private readonly AppDbContext _db;
    public FilesController(AppDbContext db) => _db = db;

    private static readonly JsonSerializerOptions SceneOpts = new(JsonSerializerDefaults.Web);
    private static readonly string[] BackgroundStyles = ["blank", "grid", "lines", "dots"];

    // Confirms an incoming scene matches the SceneDto contract before persisting.
    // Known element types are validated against their typed record; unknown/newer
    // types are tolerated (id + type only) so a new frontend element never breaks
    // saving. The raw JSON is stored verbatim, so nothing is dropped.
    private static bool TryValidateScene(JsonElement scene, out string? error)
    {
        error = null;
        if (scene.ValueKind != JsonValueKind.Object)
        { error = "scene must be a JSON object"; return false; }

        if (scene.TryGetProperty("backgroundStyle", out var bg) && bg.ValueKind == JsonValueKind.String
            && !BackgroundStyles.Contains(bg.GetString()))
        { error = $"unknown backgroundStyle '{bg.GetString()}'"; return false; }

        if (!scene.TryGetProperty("elements", out var els) || els.ValueKind != JsonValueKind.Array)
        { error = "scene.elements must be an array"; return false; }

        int i = 0;
        foreach (var el in els.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Object)
            { error = $"elements[{i}] must be an object"; return false; }
            if (!el.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.String || string.IsNullOrEmpty(id.GetString()))
            { error = $"elements[{i}] needs a non-empty id"; return false; }
            if (!el.TryGetProperty("type", out var ty) || ty.ValueKind != JsonValueKind.String || string.IsNullOrEmpty(ty.GetString()))
            { error = $"elements[{i}] needs a type"; return false; }

            if (SceneElementDto.Registry.TryGetValue(ty.GetString()!, out var clr))
            {
                try { el.Deserialize(clr, SceneOpts); }
                catch (JsonException ex) { error = $"elements[{i}] ({ty.GetString()}): {ex.Message}"; return false; }
            }
            i++;
        }
        return true;
    }

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
        {
            if (!TryValidateScene(scene, out var err))
                return BadRequest($"Invalid scene: {err}");
            file.SceneJson = scene.GetRawText();
        }

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
