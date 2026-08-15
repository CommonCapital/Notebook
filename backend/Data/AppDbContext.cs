using DrawingDesk.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace DrawingDesk.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Folder> Folders => Set<Folder>();
    public DbSet<DrawingFile> Files => Set<DrawingFile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Folder>(entity =>
        {
            entity.HasOne(f => f.ParentFolder)
                  .WithMany(f => f.Children)
                  .HasForeignKey(f => f.ParentFolderId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DrawingFile>(entity =>
        {
            entity.HasOne(f => f.Folder)
                  .WithMany(f => f.Files)
                  .HasForeignKey(f => f.FolderId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
