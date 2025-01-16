<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="1.0">
    <xsl:output method="html" version="5.0" encoding="UTF-8" indent="yes" />
    <xsl:variable name="title" select="/rss/channel/title" />
    <xsl:variable name="feedDesc" select="/rss/channel/description" />
    <xsl:variable name="copyright" select="/rss/channel/copyright" />
    
    <xsl:template match="/">
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link href="/public/styles.css" rel="stylesheet" type="text/css" media="all" />
                <title>
                    <xsl:value-of select="$title" />
                </title>
            </head>
            <xsl:apply-templates select="rss/channel" />
        </html>
    </xsl:template>
    
    <xsl:template match="channel">
        <body>
            <div class="header-container">
                <div class="glob-header">
                    <a href="https://auvio.rtbf.be" target="_blank" reel="noopener noreferer">
                        <span>Powered by</span>
                        <xsl:text>&#160;</xsl:text>
                        <xsl:text>&#160;</xsl:text>
                        <img src="https://auvio.rtbf.be/_next/static/media/logo-full.52cc8884.svg" class="logo" />
                    </a>
                </div>
                <div class="column">
                    <div class="top-block">
                        <div class="top-image">
                            <xsl:apply-templates select="image" />
                        </div>
                        <div class="top-description">
                            <h2 class="title">
                                <xsl:element name="a">
                                    <xsl:attribute name="href">
                                        <xsl:value-of select="/rss/channel/link[1]" xmlns:atom="http://www.w3.org/2005/Atom" />
                                    </xsl:attribute>
                                    <xsl:value-of select="$title" />
                                </xsl:element>
                            </h2>
                            <div class="description-block">
                                <div class="description">
                                    <p>
                                        <xsl:value-of select="$feedDesc" disable-output-escaping="yes"/>
                                    </p>
                                </div>
                                <div class="degrade-description-podcast"> </div>
                            </div>
                            <div class="copyright">(Copyright : <xsl:value-of select="$copyright" />)</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="column">
                <ul class="episode-list" xmlns="http://www.w3.org/1999/xhtml">
                    <xsl:apply-templates select="item" />
                </ul>
            </div>
        </body>
    </xsl:template>
    
    <xsl:template match="image">
        <a href="{link}" title="Link to original website">
            <xsl:element name="img" namespace="http://www.w3.org/1999/xhtml">
                <xsl:attribute name="src">
                    <xsl:value-of select="url" />
                </xsl:attribute>
                <xsl:attribute name="width">250</xsl:attribute>
            </xsl:element>
        </a>
        <xsl:text />
    </xsl:template>
    
    <!-- One block -->
    <xsl:template match="item" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
        <li class="episode">
            <a href="{link}">
                <xsl:element name="img" namespace="http://www.w3.org/1999/xhtml">
                    <xsl:attribute name="src">
                        <xsl:value-of select="itunes:image/@href" />
                    </xsl:attribute>
                    <xsl:attribute name="width">200</xsl:attribute>
                    <xsl:attribute name="height">200</xsl:attribute>
                </xsl:element>
            </a>
            <div class="item-container">
                <h4 class="itemtitle">
                    <div class="title-container">
                        <xsl:if test="string-length(link)>0">
                            <a class="title" href="{link}">
                                <xsl:value-of select="title" disable-output-escaping="yes"/>
                            </a>
                        </xsl:if>
                        <xsl:if test="string-length(link)=0">
                            <div class="title-no-link">
                                <xsl:value-of select="title" disable-output-escaping="yes"/>
                            </div>
                        </xsl:if>
                    </div>
                </h4>
                <div class="date-container">
                    <p class="date">
                        <xsl:if test="itunes:season">
                            Saison <xsl:value-of select="itunes:season" /> - 
                        </xsl:if>
                        <xsl:if test="itunes:episode">
                            Épisode <xsl:value-of select="itunes:episode" /> - <br/>
                        </xsl:if>
                        <xsl:if test="count(child::pubDate)=1">
                            <xsl:value-of select="substring(pubDate, 0, 17)" />
                        </xsl:if>
                        <xsl:if test="count(child::dc:date)=1">
                            <xsl:value-of select="dc:date" />
                        </xsl:if>
                    </p>
                </div>
                <div class="episode-description">
                    <xsl:element name="p" namespace="http://www.w3.org/1999/xhtml">
                        <xsl:attribute name="class">episode-description</xsl:attribute>
                        <xsl:value-of select="description" disable-output-escaping="yes" />
                        <br/><br/>
                    </xsl:element>
                </div>
                <div class="degrade-description"> </div>
                <div class="audio-container">
                    <xsl:if test="count(child::enclosure)&gt;0">
                        <xsl:if test="contains(enclosure/@type, 'audio')">
                            <div class="audio-file">
                                <xsl:variable name="encURL" select="enclosure/@url" xmlns:atom="http://www.w3.org/2005/Atom" />
                                <div class="audio-content">
                                    <xsl:element name="audio" namespace="http://www.w3.org/1999/xhtml">
                                        <xsl:attribute name="controls" />
                                        <xsl:attribute name="controlsList">nodownload</xsl:attribute>
                                        <xsl:attribute name="preload">none</xsl:attribute>
                                        <xsl:element name="source" namespace="http://www.w3.org/1999/xhtml">
                                            <xsl:attribute name="src">
                                                <xsl:value-of select="enclosure/@url" />
                                            </xsl:attribute>
                                            <xsl:attribute name="type">
                                                <xsl:value-of select="enclosure/@type" />
                                            </xsl:attribute>
                                        </xsl:element>
                                    </xsl:element>
                                </div>
                            </div>
                        </xsl:if>
                    </xsl:if>
                </div>
            </div>
        </li>
    </xsl:template>
    
    <xsl:template name="outputContent">
        <xsl:choose>
            <xsl:when xmlns:xhtml="http://www.w3.org/1999/xhtml" test="xhtml:body">
                <xsl:copy-of select="xhtml:body/*" />
            </xsl:when>
            <xsl:when xmlns:xhtml="http://www.w3.org/1999/xhtml" test="xhtml:div">
                <xsl:copy-of select="xhtml:div" />
            </xsl:when>
            <xsl:when xmlns:content="http://purl.org/rss/1.0/modules/content/" test="content:encoded">
                <xsl:value-of select="content:encoded" disable-output-escaping="yes" />
            </xsl:when>
            <xsl:when test="description">
                <xsl:value-of select="description" disable-output-escaping="yes" />
            </xsl:when>
        </xsl:choose>
    </xsl:template>
    
</xsl:stylesheet>
