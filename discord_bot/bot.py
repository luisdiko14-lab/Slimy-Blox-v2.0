import discord
import os
import random
from discord.ext import commands
from dotenv import load_dotenv

# --- SETUP ---
# Load the token from the .env file
load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')

# Check if token exists
if not TOKEN:
    print("❌ Error: DISCORD_TOKEN not found in .env file.")
    exit()

# Set up Intents (Required for new bots)
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

# Create the bot
bot = commands.Bot(command_prefix='!', intents=intents, help_command=None)

# --- EVENTS ---

@bot.event
async def on_ready():
    print(f'🟢 {bot.user.name} has oozed online!')
    print(f'🆔 ID: {bot.user.id}')
    await bot.change_presence(activity=discord.Game(name="Splattering Blox! | !help"))

# --- COMMANDS ---

@bot.command()
async def help(ctx):
    """Custom slimy help menu."""
    embed = discord.Embed(
        title="🟢 Slimy Blox Command List",
        description="I am a cube of sentient goo. Here is what I can do:",
        color=0x32CD32 # Lime Green
    )
    embed.add_field(name="!splat <user>", value="Throw a giant slime ball at someone.", inline=False)
    embed.add_field(name="!absorb <item>", value="Feed an item to the blob.", inline=False)
    embed.add_field(name="!cubeify <user>", value="Turn a user into a Minecraft slime block.", inline=False)
    embed.add_field(name="!sticky <user1> <user2>", value="Check how well two people stick together.", inline=False)
    embed.add_field(name="!bounce", value="Bounce around the chat.", inline=False)
    embed.set_footer(text="Beware of salt!")
    await ctx.send(embed=embed)

@bot.command()
async def splat(ctx, member: discord.Member = None):
    """Throws slime at a user."""
    if member is None:
        member = ctx.author

    splat_messages = [
        f"🟢 **SPLAT!** {ctx.author.mention} launched a glob of goo at {member.mention}!",
        f"🤢 {member.mention} slipped on a slime trail left by {ctx.author.mention}.",
        f"🟩 **GOOPED!** {member.mention} is now covered in green sludge thanks to {ctx.author.mention}."
    ]

    embed = discord.Embed(description=random.choice(splat_messages), color=0x00FF00)
    await ctx.send(embed=embed)

@bot.command()
async def absorb(ctx, *, item: str):
    """The bot eats something."""
    responses = [
        f"🟢 *Slimy Blox wobbles over and slowly engulfs the '{item}'. It is gone forever.*",
        f"😋 *Slurp.* The **{item}** tasted like pixels and jelly.",
        f"🟩 **ABSORBED.** The {item} is now floating inside my tummy."
    ]
    await ctx.send(random.choice(responses))

@bot.command()
async def cubeify(ctx, member: discord.Member):
    """Turns a user into a slime block."""
    embed = discord.Embed(title="🟩 CUBE-IFICATION COMPLETE", color=0x32CD32)
    embed.description = f"{member.mention} has been compressed into a perfect **Slime Block**."
    embed.set_thumbnail(url="https://static.wikia.nocookie.net/minecraft_gamepedia/images/4/46/Slime_Block_JE3_BE2.png") # Minecraft slime block image
    await ctx.send(embed=embed)

@bot.command()
async def sticky(ctx, member1: discord.Member, member2: discord.Member = None):
    """Checks compatibility (Sticky Meter)."""
    if member2 is None:
        member2 = ctx.author

    score = random.randint(0, 100)

    status = "Not sticky at all... 🧊"
    if score > 50: status = "Kinda gooey... 🧪"
    if score > 80: status = "SUPER STICKY! 🟢"
    if score == 100: status = "FUSED TOGETHER FOREVER! 🟩"

    embed = discord.Embed(title="🧪 Sticky Meter", color=0x00FF00)
    embed.description = f"**{member1.display_name}** and **{member2.display_name}** are **{score}%** sticky!"
    embed.add_field(name="Result", value=status)
    await ctx.send(embed=embed)

@bot.command()
async def bounce(ctx):
    """Simple fun command."""
    await ctx.send("🏀 **BOING!** *The slime block bounces off the chat walls!* **BOING!**")

# --- RUN BOT ---
bot.run(TOKEN)