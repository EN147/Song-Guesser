using Microsoft.EntityFrameworkCore;
using SongGuesser.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("db")));

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapGet("/health", () => "OK"); //Simple health check endpoint

var api = app.MapGroup("/api");

var demoSongs = new[] //This will be replaced with database calls later
{
    new { YouTubeId = "1CyRX3x6aDY", Title = "Hanashirube", Creator = "Atelier Ayesha", StartSeconds = 0 },
    new { YouTubeId = "zrApXHA2ECs", Title = "Tasugare",   Creator = "Atelier Ayesha", StartSeconds = 1 },
};

api.MapGet("/songs", () => Results.Ok(demoSongs));

app.Run();