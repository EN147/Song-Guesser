using System;
using Microsoft.EntityFrameworkCore;
using SongGuesser.Api.Models;

namespace SongGuesser.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { } //Constructor to pass the options to the base DbContext class

        public DbSet<Song> Songs => Set<Song>(); //This is the object to interact with the Songs table in the database
    }
}